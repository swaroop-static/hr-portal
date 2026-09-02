import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma, io } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendTestInvite, sendTestSubmittedAlert, sendProctorInvite } from '../email.js';

const router = Router();

// ── Candidate authenticated test routes ─────────────────
// Candidate gets their test by token (now requires CANDIDATE auth)
router.get('/attempt/:token', authenticate, async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { token: req.params.token },
      include: {
        proctor: { select: { id: true, name: true } },
        round: {
          include: {
            test: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true, type: true, options: true, order: true }
                }
              }
            }
          }
        }
      }
    });
    if (!attempt) return res.status(404).json({ error: 'Invalid test link' });

    // Only the assigned candidate, HR, or ADMIN can access
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      if (req.user.role !== 'CANDIDATE' || req.user.email.toLowerCase() !== attempt.candidateEmail.toLowerCase()) {
        return res.status(403).json({ error: 'This test is not assigned to you' });
      }
    }
    res.json(attempt);
  } catch (e) {
    console.error('get attempt by token error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/attempt/:token/start', authenticate, async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { token: req.params.token }
    });
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'CANDIDATE' && attempt.candidateEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!['CANDIDATE', 'HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (['SUBMITTED', 'TERMINATED'].includes(attempt.status)) {
      return res.status(400).json({ error: 'Test has already been completed' });
    }
    const updated = await prisma.testAttempt.update({
      where: { token: req.params.token },
      data: { status: 'IN_PROGRESS', startedAt: new Date() }
    });
    res.json(updated);
  } catch (e) {
    console.error('start attempt error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/attempt/:token/submit', authenticate, async (req, res) => {
  try {
    const { responses } = req.body;
    const attempt = await prisma.testAttempt.findUnique({
      where: { token: req.params.token },
      include: { round: { include: { test: { include: { questions: true } } } } }
    });
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'CANDIDATE' && attempt.candidateEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!['CANDIDATE', 'HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Server-side duration enforcement: reject if submitted more than 60s past the allowed window
    if (attempt.startedAt) {
      const durationMs = attempt.round.test.duration * 60 * 1000;
      const elapsed = Date.now() - new Date(attempt.startedAt).getTime();
      if (elapsed > durationMs + 60_000) {
        await prisma.testAttempt.update({
          where: { token: req.params.token },
          data: { status: 'TERMINATED', submittedAt: new Date() }
        });
        const r = await prisma.round.update({
          where: { id: attempt.roundId },
          data: { status: 'FAILED', completedAt: new Date() }
        });
        await prisma.application.update({ where: { id: r.applicationId }, data: { status: 'REJECTED' } });
        return res.status(400).json({ error: 'Time limit exceeded. Test has been terminated.' });
      }
    }

    const questions = attempt.round.test.questions;
    let correct = 0;
    const parsed = responses || {};
    questions.forEach(q => {
      if (q.type === 'MCQ' && q.answer !== null && parsed[q.id] === q.answer) correct++;
    });
    const mcqCount = questions.filter(q => q.type === 'MCQ').length;
    const score = mcqCount > 0 ? Math.round((correct / mcqCount) * 100) : 0;
    const passed = mcqCount > 0 ? score >= 60 : false;
    const requiresManualGrading = mcqCount === 0;

    const updated = await prisma.testAttempt.update({
      where: { token: req.params.token },
      data: { responses: JSON.stringify(responses), status: 'SUBMITTED', submittedAt: new Date(), score }
    });

    const round = await prisma.round.update({
      where: { id: attempt.roundId },
      data: { status: passed ? 'PASSED' : 'FAILED', completedAt: new Date() }
    });

    // Auto-update application status
    if (!passed) {
      await prisma.application.update({
        where: { id: round.applicationId },
        data: { status: 'REJECTED' }
      });
    }

    if (passed) {
      // Check if all rounds for this application now pass
      const allRounds = await prisma.round.findMany({
        where: { applicationId: attempt.round.applicationId }
      });
      const updatedRounds = allRounds.map(r =>
        r.id === attempt.round.id ? { ...r, status: 'PASSED' } : r
      );
      const allPassed = updatedRounds.every(r => r.status === 'PASSED');
      if (allPassed) {
        await prisma.application.update({
          where: { id: attempt.round.applicationId },
          data: { status: 'SELECTED' }
        });
      }
    }

    res.json({ ...updated, passed, score, requiresManualGrading });

    // Notify HR non-blocking
    prisma.user.findFirst({ where: { role: 'HR' }, select: { email: true } })
      .then(hr => {
        if (!hr) return;
        return sendTestSubmittedAlert({
          hrEmail: hr.email,
          candidateName: attempt.candidateName,
          testTitle: attempt.round.test.title,
          score: mcqCount > 0 ? score : null,
        });
      }).catch(() => {});
  } catch (e) {
    console.error('submit attempt error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/attempt/:token/tab-switch', authenticate, async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { token: req.params.token }
    });
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'CANDIDATE' && attempt.candidateEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!['CANDIDATE', 'HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (['SUBMITTED', 'TERMINATED'].includes(attempt.status)) {
      return res.status(400).json({ error: 'Test already completed' });
    }
    const updated = await prisma.testAttempt.update({
      where: { token: req.params.token },
      data: { tabSwitches: { increment: 1 } }
    });

    // Notify proctor via socket (single source of truth — no duplicate DB increment)
    io.to(`proctor-${updated.id}`).emit('tab-switch-alert', { tabSwitches: updated.tabSwitches });

    if (updated.tabSwitches >= 2) {
      await prisma.testAttempt.update({
        where: { token: req.params.token },
        data: { status: 'TERMINATED', submittedAt: new Date() }
      });
      const round = await prisma.round.update({
        where: { id: attempt.roundId },
        data: { status: 'FAILED', completedAt: new Date() }
      });
      await prisma.application.update({
        where: { id: round.applicationId },
        data: { status: 'REJECTED' }
      });
      io.to(`candidate-${updated.id}`).emit('test-terminated');
      io.to(`proctor-${updated.id}`).emit('test-terminated');
      return res.json({ terminated: true, tabSwitches: updated.tabSwitches });
    }
    res.json({ terminated: false, tabSwitches: updated.tabSwitches });
  } catch (e) {
    console.error('tab-switch error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/attempt/:token/terminate', authenticate, async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { token: req.params.token }
    });
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'CANDIDATE' && attempt.candidateEmail.toLowerCase() !== req.user.email.toLowerCase()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (!['CANDIDATE', 'HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (attempt.status === 'SUBMITTED') {
      return res.status(400).json({ error: 'Test already submitted' });
    }
    await prisma.testAttempt.update({
      where: { token: req.params.token },
      data: { status: 'TERMINATED', submittedAt: new Date() }
    });
    const round = await prisma.round.update({
      where: { id: attempt.roundId },
      data: { status: 'FAILED', completedAt: new Date() }
    });
    await prisma.application.update({
      where: { id: round.applicationId },
      data: { status: 'REJECTED' }
    });
    res.json({ success: true });
  } catch (e) {
    console.error('terminate attempt error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update proctor on an existing attempt
router.put('/attempt/:token/proctor', authenticate, authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { proctorId } = req.body;
    const attempt = await prisma.testAttempt.findUnique({ where: { token: req.params.token } });
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    const updated = await prisma.testAttempt.update({
      where: { token: req.params.token },
      data: { proctorId: proctorId || null },
      include: { proctor: { select: { id: true, name: true } } }
    });
    res.json(updated);
  } catch (e) {
    console.error('update proctor error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get test attempts assigned to the current user as proctor
router.get('/proctor/mine', authenticate, authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    // HR/ADMIN see only their assigned sessions; INTERVIEWER sees all IN_PROGRESS tests
    const where = ['HR', 'ADMIN'].includes(req.user.role)
      ? { OR: [{ proctorId: req.user.id }, { round: { interviewerId: req.user.id } }] }
      : { OR: [{ status: 'IN_PROGRESS' }, { proctorId: req.user.id }, { round: { interviewerId: req.user.id } }] };
    const attempts = await prisma.testAttempt.findMany({
      where,
      include: {
        round: {
          include: {
            test: { select: { title: true, duration: true } },
            application: {
              select: { candidateName: true, candidateEmail: true, position: { select: { title: true } } }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(attempts);
  } catch (e) {
    console.error('list proctor attempts error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attempt by DB ID (for HR/ADMIN/INTERVIEWER — used by proctor view and response viewer)
router.get('/attempt/id/:id', authenticate, authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: req.params.id },
      include: {
        proctor: { select: { id: true, name: true } },
        round: {
          include: {
            test: {
              include: {
                questions: { orderBy: { order: 'asc' } }
              }
            },
            application: {
              select: { candidateName: true, candidateEmail: true, position: { select: { title: true } } }
            }
          }
        }
      }
    });
    if (!attempt) return res.status(404).json({ error: 'Not found' });
    res.json(attempt);
  } catch (e) {
    console.error('get attempt by id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attempt by DB ID with parsed responses/grading (response viewer + grading page)
router.get('/attempt/by-id/:id', authenticate, authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({
      where: { id: req.params.id },
      include: {
        round: {
          include: {
            interviewer: { select: { id: true, name: true } },
            application: { select: { candidateName: true, candidateEmail: true } },
            test: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true, type: true, options: true, answer: true, order: true }
                }
              }
            }
          }
        }
      }
    });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });

    // For INTERVIEWER: verify they are assigned to the round
    if (req.user.role === 'INTERVIEWER') {
      const round = await prisma.round.findUnique({
        where: { id: attempt.roundId },
        select: { interviewerId: true }
      });
      if (!round || round.interviewerId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // For live IN_PROGRESS tests, any interviewer can monitor.
    // For completed attempts, only the assigned interviewer or proctor can access responses.
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      if (attempt.status !== 'IN_PROGRESS') {
        const isAssigned = attempt.proctorId === req.user.id || attempt.round?.interviewerId === req.user.id;
        if (!isAssigned) return res.status(403).json({ error: 'Access denied' });
      }
    }

    // All roles can see IN_PROGRESS (for proctoring), SUBMITTED, and TERMINATED
    if (!['IN_PROGRESS', 'SUBMITTED', 'TERMINATED'].includes(attempt.status)) {
      return res.status(400).json({ error: 'Attempt is not available yet' });
    }

    const responses = (() => {
      try { return attempt.responses ? JSON.parse(attempt.responses) : {}; } catch { return {}; }
    })();
    const grading = (() => {
      try { return attempt.grading ? JSON.parse(attempt.grading) : {}; } catch { return {}; }
    })();

    res.json({ ...attempt, responses, grading });
  } catch (e) {
    console.error('get attempt by-id error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Grade text questions on a submitted attempt (INTERVIEWER only)
router.put('/attempt/:id/grade', authenticate, authorize('INTERVIEWER'), async (req, res) => {
  try {
    const { grades } = req.body;
    if (!grades || typeof grades !== 'object') {
      return res.status(400).json({ error: 'Grades are required' });
    }

    const attempt = await prisma.testAttempt.findUnique({
      where: { id: req.params.id },
      include: {
        round: {
          include: {
            application: true,
            test: { include: { questions: true } }
          }
        }
      }
    });
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (!attempt.round || attempt.round.interviewerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (attempt.status !== 'SUBMITTED') {
      return res.status(400).json({ error: 'Attempt is not submitted yet' });
    }

    const questions = attempt.round.test.questions;
    const textQuestions = questions.filter(q => q.type === 'TEXT');
    if (textQuestions.length === 0) {
      return res.status(400).json({ error: 'No text questions to grade' });
    }

    const parsedResponses = (() => {
      try { return attempt.responses ? JSON.parse(attempt.responses) : {}; } catch { return {}; }
    })();
    const existingGrading = (() => {
      try { return attempt.grading ? JSON.parse(attempt.grading) : {}; } catch { return {}; }
    })();

    const updatedGrading = { ...existingGrading };
    let scoredFraction = 0;

    for (const q of textQuestions) {
      const entry = grades[q.id];
      if (entry === undefined || entry === null) {
        return res.status(400).json({ error: 'Grades are required for every text question' });
      }
      const maxMarks = q.maxMarks ?? 1;
      const score = Number(entry.score);
      const feedback = entry.feedback ? String(entry.feedback) : '';

      if (Number.isNaN(score)) {
        return res.status(400).json({ error: `Score must be numeric for question ${q.order + 1}` });
      }
      if (score < 0) {
        return res.status(400).json({ error: `Score cannot be negative for question ${q.order + 1}` });
      }
      if (score > maxMarks) {
        return res.status(400).json({ error: `Score cannot exceed maximum marks (${maxMarks}) for question ${q.order + 1}` });
      }

      updatedGrading[q.id] = { score, feedback };
      scoredFraction += maxMarks ? score / maxMarks : 0;
    }

    const mcqQuestions = questions.filter(q => q.type === 'MCQ');
    const correctMcqCount = mcqQuestions.reduce((sum, q) =>
      sum + (parsedResponses[q.id] === q.answer ? 1 : 0), 0);
    const totalQuestions = questions.length;
    const totalScore = totalQuestions
      ? Math.round(((correctMcqCount + scoredFraction) / totalQuestions) * 100)
      : 0;
    const passed = totalScore >= 60;

    const updated = await prisma.testAttempt.update({
      where: { id: req.params.id },
      data: { grading: JSON.stringify(updatedGrading), gradedById: req.user.id, gradedAt: new Date(), score: totalScore }
    });

    await prisma.round.update({
      where: { id: attempt.roundId },
      data: { status: passed ? 'PASSED' : 'FAILED', completedAt: new Date() }
    });

    if (passed) {
      const allRounds = await prisma.round.findMany({ where: { applicationId: attempt.round.applicationId } });
      const allPassed = allRounds.every(r => r.status === 'PASSED' || r.id === attempt.roundId);
      if (allPassed) {
        await prisma.application.update({ where: { id: attempt.round.applicationId }, data: { status: 'SELECTED' } });
      }
    } else {
      await prisma.application.update({ where: { id: attempt.round.applicationId }, data: { status: 'REJECTED' } });
    }

    res.json({ ...updated, responses: parsedResponses, grading: updatedGrading, passed });
  } catch (e) {
    console.error('grade attempt error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── HR / Admin authenticated routes ─────────────────────
router.use(authenticate);

router.get('/', authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    if (page !== null) {
      const [tests, total] = await Promise.all([
        prisma.test.findMany({
          include: {
            _count: { select: { questions: true } },
            createdBy: { select: { id: true, name: true, role: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.test.count()
      ]);
      return res.json({ data: tests, total, page, totalPages: Math.ceil(total / limit) });
    }

    const tests = await prisma.test.findMany({
      include: {
        _count: { select: { questions: true } },
        createdBy: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tests);
  } catch (e) {
    console.error('list tests error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const { title, description, duration, questions } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Test title is required' });
    }
    const dur = Number(duration);
    if (!duration || isNaN(dur) || dur < 5 || dur > 300) {
      return res.status(400).json({ error: 'Duration must be between 5 and 300 minutes' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'At least one question is required' });
    }
    const test = await prisma.test.create({
      data: {
        title, description, duration,
        createdById: req.user.id,
        questions: {
          create: questions.map((q, i) => ({
            text: q.text,
            type: q.type,
            options: q.options ? JSON.stringify(q.options) : null,
            answer: q.answer !== undefined ? String(q.answer) : null,
            order: q.order ?? i
          }))
        }
      },
      include: { questions: { orderBy: { order: 'asc' } } }
    });
    res.status(201).json(test);
  } catch (e) {
    console.error('create test error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const test = await prisma.test.findUnique({
      where: { id: req.params.id },
      include: { questions: { orderBy: { order: 'asc' } } }
    });
    if (!test) return res.status(404).json({ error: 'Not found' });
    res.json(test);
  } catch (e) {
    console.error('get test error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    await prisma.question.deleteMany({ where: { testId: req.params.id } });
    await prisma.test.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    console.error('delete test error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/generate-link', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { roundId, candidateName, candidateEmail, proctorId } = req.body;

    // Validate roundId belongs to this test
    const round = await prisma.round.findUnique({ where: { id: roundId } });
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    if (round.testId !== req.params.id) {
      return res.status(400).json({ error: 'Round is not assigned to this test' });
    }

    // Prevent retake — if attempt already exists for this round, block regeneration
    const existing = await prisma.testAttempt.findUnique({ where: { roundId } });
    const baseUrl = req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:5173';
    if (existing) {
      if (['SUBMITTED', 'TERMINATED'].includes(existing.status)) {
        return res.status(409).json({
          error: `Test already ${existing.status.toLowerCase()}. A new link cannot be generated.`,
          alreadyExists: true,
          status: existing.status
        });
      }
      const link = `${baseUrl}/test/${existing.token}`;
      return res.json({ attempt: existing, link, token: existing.token, alreadyExists: true });
    }

    const token = uuidv4();
    let attempt;
    try {
      attempt = await prisma.testAttempt.create({
        data: {
          roundId,
          token,
          candidateName,
          candidateEmail,
          proctorId: proctorId || null
        },
        include: { proctor: { select: { name: true } } }
      });
    } catch (e) {
      if (e.code === 'P2002') {
        attempt = await prisma.testAttempt.findUnique({ where: { roundId } });
      } else throw e;
    }

    // Update round to IN_PROGRESS
    await prisma.round.update({ where: { id: roundId }, data: { status: 'IN_PROGRESS' } });

    const link = `${req.get('origin') || process.env.FRONTEND_URL || 'http://localhost:5173'}/test/${token}`;
    res.json({ attempt, link, token });

    // Send invite + proctor emails non-blocking
    prisma.test.findUnique({ where: { id: req.params.id }, select: { title: true, duration: true } })
      .then(async test => {
        if (!test) return;
        const app = await prisma.application.findUnique({ where: { id: round.applicationId }, select: { candidatePassword: true } });
        await sendTestInvite({
          candidateName,
          candidateEmail,
          candidatePassword: app?.candidatePassword || '',
          testTitle: test.title,
          testToken: token,
          duration: test.duration,
        });
        const notifyId = proctorId || round.interviewerId;
        if (notifyId) {
          const proctor = await prisma.user.findUnique({ where: { id: notifyId }, select: { name: true, email: true } });
          if (proctor) {
            const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            await sendProctorInvite({
              proctorName: proctor.name,
              proctorEmail: proctor.email,
              candidateName,
              testTitle: test.title,
              proctorLink: `${baseUrl}/hr/proctor/${attempt.id}`,
            });
          }
        }
      }).catch(() => {});
  } catch (e) {
    console.error('generate link error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
