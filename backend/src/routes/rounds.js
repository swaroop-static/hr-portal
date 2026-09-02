import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendInterviewInvite } from '../email.js';
import { logAudit } from '../middleware/audit.js';
import { notifyUser, notifyUsers } from '../middleware/notify.js';

const router = Router();
router.use(authenticate);

router.get('/application/:applicationId', authorize('HR', 'ADMIN', 'MANAGER', 'INTERVIEWER'), async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { applicationId: req.params.applicationId },
      include: {
        interviewer: { select: { name: true, email: true } },
        test: { select: { id: true, title: true, duration: true } },
        testAttempt: {
          include: { proctor: { select: { name: true, email: true } } }
        }
      },
      orderBy: { order: 'asc' }
    });
    res.json(rounds);
  } catch (e) {
    console.error('list rounds error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { applicationId, type, order, interviewerId, testId, scheduledAt } = req.body;
    const interviewTypes = ['TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW'];
    if (interviewTypes.includes(type) && !interviewerId) {
      return res.status(400).json({ error: 'Interviewer is required for interview rounds' });
    }
    const round = await prisma.round.create({
      data: {
        applicationId,
        type,
        order,
        interviewerId: interviewerId || null,
        testId: testId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null
      },
      include: {
        interviewer: { select: { name: true } },
        test: { select: { title: true } }
      }
    });
    // Set application to IN_PROGRESS when first round added
    await prisma.application.updateMany({
      where: { id: applicationId, status: 'PENDING' },
      data: { status: 'IN_PROGRESS' }
    });
    res.status(201).json(round);

    // Send interview invite emails (best-effort, non-blocking)
    try {
      if (['TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW'].includes(round.type)
          && round.scheduledAt && round.interviewerId) {
        const interviewer = await prisma.user.findUnique({ where: { id: round.interviewerId }, select: { email: true, name: true } });
        const app = await prisma.application.findUnique({
          where: { id: applicationId },
          select: { candidateName: true, candidateEmail: true, candidatePassword: true, position: { select: { title: true } } }
        });
        if (interviewer && app) {
          const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          await sendInterviewInvite({
            candidateName: app.candidateName,
            candidateEmail: app.candidateEmail,
            candidatePassword: app.candidatePassword || '',
            interviewerName: interviewer.name,
            interviewerEmail: interviewer.email,
            roundType: round.type,
            positionTitle: app.position?.title || '',
            interviewLink: `${baseUrl}/interview/${round.id}`,
            scheduledAt: round.scheduledAt,
          });
        }
      }
    } catch (emailErr) {
      console.error('[email] interview invite failed:', emailErr.message);
    }

    // Notify assigned interviewer (fire-and-forget)
    if (round.interviewerId) {
      try {
        const app = await prisma.application.findUnique({
          where: { id: applicationId },
          include: { position: { select: { title: true } } }
        });
        notifyUser({
          userId: round.interviewerId,
          type: 'ROUND_ASSIGNED',
          title: 'New interview assignment',
          body: `You have been assigned to interview ${app?.candidateName || 'a candidate'} for ${app?.position?.title || 'a position'}`,
          link: `/interview/${round.id}`,
          emailContext: {
            candidateName: app?.candidateName,
            positionTitle: app?.position?.title,
            roundType: round.type,
            hasScheduledInvite: !!(round.scheduledAt),
          }
        }).catch(() => {});
      } catch {}
    }
  } catch (e) {
    console.error('create round error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('HR', 'INTERVIEWER', 'ADMIN'), async (req, res) => {
  try {
    const { status, notes, interviewerId, testId, scheduledAt, scorecard } = req.body;

    // Fetch existing round before update to compare testId
    const existingRound = await prisma.round.findUnique({ where: { id: req.params.id } });

    const data = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (interviewerId !== undefined) data.interviewerId = interviewerId || null;
    if (testId !== undefined) data.testId = testId || null;
    if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (scorecard !== undefined) data.scorecard = scorecard;
    if (status === 'PASSED' || status === 'FAILED') data.completedAt = new Date();

    const round = await prisma.round.update({
      where: { id: req.params.id },
      data,
      include: {
        application: true,
        interviewer: { select: { name: true } },
        test: { select: { title: true } },
        testAttempt: true
      }
    });

    // Clean up stale TestAttempt if testId was changed
    if (data.testId && existingRound && existingRound.testId !== data.testId) {
      await prisma.testAttempt.deleteMany({ where: { roundId: round.id } });
    }

    // Auto-update application status based on round outcome
    if (status === 'FAILED') {
      await prisma.application.update({
        where: { id: round.applicationId },
        data: { status: 'REJECTED' }
      });
    } else if (status === 'PASSED') {
      // Check if all rounds passed
      const allRounds = await prisma.round.findMany({
        where: { applicationId: round.applicationId }
      });
      const updatedRounds = allRounds.map(r => r.id === round.id ? { ...r, status: data.status } : r);
      const allPassed = updatedRounds.every(r => r.status === 'PASSED');
      const anyPending = allRounds.some(r => r.id !== round.id && r.status === 'PENDING');
      if (allPassed && !anyPending) {
        await prisma.application.update({
          where: { id: round.applicationId },
          data: { status: 'SELECTED' }
        });
      }
    }

    res.json(round);

    // Audit log for status changes
    if (status !== undefined && existingRound && existingRound.status !== status) {
      logAudit({
        userId: req.user.id, userEmail: req.user.email,
        action: 'ROUND_STATUS_CHANGED',
        entityType: 'Round', entityId: req.params.id,
        before: { status: existingRound.status }, after: { status },
        ip: req.ip
      }).catch(() => {});

      // Notify candidate when round result is final
      if (status === 'PASSED' || status === 'FAILED') {
        try {
          const app = await prisma.application.findUnique({
            where: { id: round.applicationId },
            include: { position: { select: { title: true } } }
          });
          if (app) {
            const candidate = await prisma.user.findFirst({ where: { email: app.candidateEmail } });
            if (candidate) {
              notifyUser({
                userId: candidate.id,
                type: status === 'PASSED' ? 'ROUND_PASSED' : 'ROUND_FAILED',
                title: status === 'PASSED' ? 'Round result: Passed' : 'Round result: Not passed',
                body: `Your ${round.type.replace(/_/g, ' ').toLowerCase()} for ${app.position?.title} has been reviewed`,
                link: '/candidate',
                emailContext: {
                  positionTitle: app.position?.title,
                  roundType: round.type,
                }
              }).catch(() => {});
            }
            // Also notify HR/ADMIN that round is completed
            const hrAdmins = await prisma.user.findMany({
              where: { role: { in: ['HR', 'ADMIN'] }, isActive: true },
              select: { id: true }
            });
            notifyUsers(
              hrAdmins.map(u => u.id),
              {
                type: 'ROUND_COMPLETED',
                title: 'Round completed',
                body: `${app.candidateName}'s ${round.type.replace(/_/g, ' ').toLowerCase()} is ${status.toLowerCase()}`,
                link: `/hr/applications/${app.id}`,
                emailContext: {
                  candidateName: app.candidateName,
                  positionTitle: app.position?.title,
                  roundType: round.type,
                }
              }
            );
          }
        } catch {}
      }
    }
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Round not found' });
    console.error('update round error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save interviewer scorecard
router.put('/:id/scorecard', authorize('INTERVIEWER', 'HR', 'ADMIN'), async (req, res) => {
  try {
    const { scorecard } = req.body;
    if (!scorecard) return res.status(400).json({ error: 'scorecard is required' });
    const round = await prisma.round.findUnique({ where: { id: req.params.id }, select: { interviewerId: true } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    if (req.user.role === 'INTERVIEWER' && round.interviewerId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    const updated = await prisma.round.update({
      where: { id: req.params.id },
      data: { scorecard: typeof scorecard === 'string' ? scorecard : JSON.stringify(scorecard) },
      select: { id: true, scorecard: true }
    });
    res.json(updated);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/interviewer/mine', authorize('INTERVIEWER', 'ADMIN', 'HR'), async (req, res) => {
  try {
    const rounds = await prisma.round.findMany({
      where: { interviewerId: req.user.id },
      include: {
        application: {
          include: {
            position: { select: { title: true, department: true } },
            rounds: {
              where: { type: 'TEST' },
              include: { testAttempt: { select: { score: true, status: true, tabSwitches: true } } },
              orderBy: { order: 'asc' }
            }
          }
        },
        test: { select: { title: true } },
        testAttempt: { include: { proctor: { select: { name: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(rounds);
  } catch (e) {
    console.error('list interviewer rounds error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Candidate: get their active test
router.get('/candidate/my-test', authorize('CANDIDATE'), async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { candidateEmail: req.user.email },
      include: {
        position: { select: { title: true, department: true } },
        rounds: {
          where: { type: 'TEST' },
          include: {
            test: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                  select: { id: true, text: true, type: true, options: true, order: true }
                }
              }
            },
            testAttempt: true
          },
          orderBy: { order: 'asc' }
        }
      }
    });

    const activeTests = [];
    const pastTests = [];
    for (const app of applications) {
      for (const round of app.rounds) {
        if (!round.testAttempt) continue;
        const entry = {
          application: { id: app.id, candidateName: app.candidateName, position: app.position },
          round,
          attempt: round.testAttempt
        };
        if (['PENDING', 'IN_PROGRESS'].includes(round.testAttempt.status)) {
          activeTests.push(entry);
        } else {
          pastTests.push(entry);
        }
      }
    }
    // Also fetch non-TEST interview rounds
    const interviewApps = await prisma.application.findMany({
      where: { candidateEmail: req.user.email },
      include: {
        position: { select: { title: true, department: true } },
        rounds: {
          where: { type: { not: 'TEST' } },
          include: { interviewer: { select: { name: true, email: true } } },
          orderBy: { order: 'asc' }
        }
      }
    });
    const activeInterviews = [];
    for (const app of interviewApps) {
      for (const round of app.rounds) {
        if (['PENDING', 'IN_PROGRESS'].includes(round.status)) {
          activeInterviews.push({ application: { id: app.id, candidateName: app.candidateName, position: app.position }, round });
        }
      }
    }

    res.json({ activeTests, pastTests, activeInterviews });
  } catch (e) {
    console.error('candidate my-test error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single round by ID — INTERVIEWER (own), HR, ADMIN, CANDIDATE (own)
router.get('/:id', authorize('HR', 'ADMIN', 'INTERVIEWER', 'CANDIDATE'), async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: {
        application: {
          select: { candidateName: true, candidateEmail: true, positionId: true,
            position: { select: { title: true, department: true } } }
        },
        interviewer: { select: { id: true, name: true, email: true } },
        test: { select: { id: true, title: true, duration: true } },
        testAttempt: { select: { id: true, status: true, score: true, tabSwitches: true } }
      }
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    const isInterviewer = round.interviewerId === req.user.id;
    const isCandidate = req.user.role === 'CANDIDATE' &&
      round.application?.candidateEmail?.toLowerCase() === req.user.email?.toLowerCase();
    if (!isInterviewer && !isCandidate && !['HR', 'ADMIN'].includes(req.user.role))
      return res.status(403).json({ error: 'Access denied' });

    res.json(round);
  } catch (e) {
    console.error('get round error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save interviewer's live notes during a call
router.put('/:id/live-notes', authorize('INTERVIEWER', 'HR', 'ADMIN'), async (req, res) => {
  try {
    const { liveNotes } = req.body;
    const round = await prisma.round.findUnique({ where: { id: req.params.id }, select: { interviewerId: true } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    if (req.user.role === 'INTERVIEWER' && round.interviewerId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    const updated = await prisma.round.update({
      where: { id: req.params.id },
      data: { liveNotes: liveNotes ?? null },
      select: { id: true, liveNotes: true }
    });
    res.json(updated);
  } catch (e) {
    console.error('live-notes error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save session state (code, chat, canvas, timer) for cross-device recovery
router.put('/:id/session', async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      select: { interviewerId: true, applicationId: true, sessionData: true, application: { select: { candidateEmail: true } } }
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    const isInterviewer = round.interviewerId === req.user.id;
    const isCandidate = req.user.role === 'CANDIDATE' &&
      round.application?.candidateEmail?.toLowerCase() === req.user.email?.toLowerCase();
    if (!isInterviewer && !isCandidate && !['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { code, language, chatHistory, canvas, timerStart } = req.body;
    let existing = {};
    if (round.sessionData) {
      try { existing = JSON.parse(round.sessionData); } catch {}
    }
    const merged = { ...existing };
    if (code !== undefined) merged.code = code;
    if (language !== undefined) merged.language = language;
    if (chatHistory !== undefined) merged.chatHistory = chatHistory;
    if (canvas !== undefined) merged.canvas = canvas;
    if (timerStart !== undefined) merged.timerStart = timerStart;

    await prisma.round.update({
      where: { id: req.params.id },
      data: { sessionData: JSON.stringify(merged) }
    });
    res.json({ success: true });
  } catch (e) {
    console.error('session save error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single round for interview room access (interviewer or candidate)
router.get('/:id/interview-room', authenticate, async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, type: true, status: true, order: true, liveNotes: true, scorecard: true,
        interviewerId: true, testId: true, scheduledAt: true, sessionData: true,
        application: { select: { candidateName: true, candidateEmail: true, resumePath: true, resumeName: true, position: { select: { title: true } } } },
        interviewer: { select: { id: true, name: true, email: true } }
      }
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    const isInterviewer = round.interviewerId === req.user.id;
    const isCandidate = req.user.role === 'CANDIDATE' && round.application?.candidateEmail?.toLowerCase() === req.user.email?.toLowerCase();
    if (!isInterviewer && !isCandidate && !['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ round, role: isCandidate ? 'candidate' : 'interviewer' });
  } catch (e) {
    console.error('interview-room error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id/candidate-feedback', authorize('CANDIDATE'), async (req, res) => {
  try {
    const { respect, clarity, overall, comment } = req.body;
    const round = await prisma.round.findUnique({ where: { id: req.params.id }, include: { application: { select: { candidateEmail: true } } } });
    if (!round) return res.status(404).json({ error: 'Round not found' });
    if (round.application?.candidateEmail?.toLowerCase() !== req.user.email?.toLowerCase()) return res.status(403).json({ error: 'Access denied' });
    const updated = await prisma.round.update({
      where: { id: req.params.id },
      data: { candidateFeedback: JSON.stringify({ respect, clarity, overall, comment, submittedAt: new Date().toISOString() }) },
      select: { id: true, candidateFeedback: true }
    });
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
