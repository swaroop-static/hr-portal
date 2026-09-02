import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('HR', 'ADMIN', 'MANAGER'));

router.get('/summary', async (req, res) => {
  try {
    const [totalApps, openPositions, totalRounds, testAttempts] = await Promise.all([
      prisma.application.count(),
      prisma.jobPosition.count({ where: { status: 'OPEN' } }),
      prisma.round.count({ where: { type: { not: 'TEST' } } }),
      prisma.testAttempt.findMany({ select: { score: true, status: true } }),
    ]);
    const scored = testAttempts.filter(a => a.score !== null);
    const avgScore = scored.length ? Math.round(scored.reduce((s, a) => s + (a.score ?? 0), 0) / scored.length) : 0;
    res.json({ totalApps, openPositions, totalRounds, avgScore });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/funnel', async (req, res) => {
  try {
    const [pending, inProgress, selected, rejected] = await Promise.all([
      prisma.application.count({ where: { status: 'PENDING' } }),
      prisma.application.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.application.count({ where: { status: 'SELECTED' } }),
      prisma.application.count({ where: { status: 'REJECTED' } }),
    ]);
    res.json({ pending, inProgress, selected, rejected });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/rounds-by-type', async (req, res) => {
  try {
    const types = ['TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW', 'TEST'];
    const counts = await Promise.all(types.map(t => prisma.round.count({ where: { type: t } })));
    res.json(Object.fromEntries(types.map((t, i) => [t, counts[i]])));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/recent-activity', async (req, res) => {
  try {
    const apps = await prisma.application.findMany({
      take: 10, orderBy: { createdAt: 'desc' },
      include: { position: { select: { title: true } } },
      select: { id: true, candidateName: true, status: true, createdAt: true, position: { select: { title: true } } }
    });
    res.json(apps);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/interviewer-stats', async (req, res) => {
  try {
    const interviewers = await prisma.user.findMany({
      where: { role: 'INTERVIEWER', isActive: true },
      select: { id: true, name: true, rounds: { where: { type: { not: 'TEST' } }, select: { status: true } } },
      include: { rounds: { where: { type: { not: 'TEST' } }, select: { status: true, id: true } } }
    });
    const stats = interviewers.map(u => ({
      name: u.name,
      total: u.rounds.length,
      completed: u.rounds.filter((r) => ['PASSED', 'FAILED'].includes(r.status)).length,
      passed: u.rounds.filter((r) => r.status === 'PASSED').length,
    }));
    res.json(stats);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// Manager-scoped summary — MANAGER sees only their positions; HR/ADMIN see all
router.get('/manager-summary', async (req, res) => {
  try {
    const isManager = req.user.role === 'MANAGER';
    const positionWhere = isManager ? { managerId: req.user.id } : {};
    const positions = await prisma.jobPosition.findMany({
      where: positionWhere,
      include: { _count: { select: { applications: true } } }
    });
    const positionIds = positions.map(p => p.id);
    const [apps, roundCounts] = await Promise.all([
      prisma.application.findMany({
        where: { positionId: { in: positionIds } },
        select: { status: true }
      }),
      prisma.round.count({ where: { application: { positionId: { in: positionIds } } } })
    ]);
    const pipeline = {
      pending: apps.filter(a => a.status === 'PENDING').length,
      inProgress: apps.filter(a => a.status === 'IN_PROGRESS').length,
      selected: apps.filter(a => a.status === 'SELECTED').length,
      rejected: apps.filter(a => a.status === 'REJECTED').length,
    };
    res.json({
      totalPositions: positions.length,
      openPositions: positions.filter(p => p.status === 'OPEN').length,
      totalApplications: apps.length,
      totalRounds: roundCounts,
      pipeline,
      positions: positions.map(p => ({
        id: p.id, title: p.title, department: p.department,
        status: p.status, vacancies: p.vacancies,
        applicationCount: p._count.applications
      }))
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

// Command center — live ops data for HR/ADMIN
router.get('/command-center', async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [todayInterviews, pendingReviews, pipeline, recentApps] = await Promise.all([
      prisma.round.findMany({
        where: {
          type: { in: ['TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW'] },
          scheduledAt: { gte: todayStart, lte: todayEnd }
        },
        include: {
          application: { include: { position: { select: { title: true } } } },
          interviewer: { select: { name: true } }
        },
        orderBy: { scheduledAt: 'asc' }
      }),
      prisma.round.findMany({
        where: {
          type: { in: ['TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_INTERVIEW'] },
          status: { in: ['PASSED', 'FAILED'] },
          scorecard: null
        },
        include: {
          application: { include: { position: { select: { title: true } } } },
          interviewer: { select: { name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 10
      }),
      Promise.all([
        prisma.application.count({ where: { status: 'PENDING' } }),
        prisma.application.count({ where: { status: 'IN_PROGRESS' } }),
        prisma.application.count({ where: { status: 'SELECTED' } }),
        prisma.application.count({ where: { status: 'REJECTED' } }),
      ]),
      prisma.application.findMany({
        take: 5, orderBy: { createdAt: 'desc' },
        include: { position: { select: { title: true } } }
      })
    ]);

    res.json({
      todayInterviews: todayInterviews.map(r => ({
        id: r.id,
        type: r.type,
        status: r.status,
        scheduledAt: r.scheduledAt,
        candidateName: r.application.candidateName,
        positionTitle: r.application.position?.title,
        applicationId: r.application.id,
        interviewerName: r.interviewer?.name
      })),
      pendingReviews: pendingReviews.map(r => ({
        id: r.id,
        type: r.type,
        status: r.status,
        candidateName: r.application.candidateName,
        positionTitle: r.application.position?.title,
        applicationId: r.application.id,
        interviewerName: r.interviewer?.name
      })),
      pipeline: {
        pending: pipeline[0], inProgress: pipeline[1],
        selected: pipeline[2], rejected: pipeline[3]
      },
      recentApplications: recentApps.map(a => ({
        id: a.id, candidateName: a.candidateName,
        positionTitle: a.position?.title, status: a.status, createdAt: a.createdAt
      }))
    });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
