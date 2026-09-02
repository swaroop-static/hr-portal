import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Get code snapshots for a round — INTERVIEWER, HR, ADMIN
router.get('/:id/snapshots', authorize('INTERVIEWER', 'HR', 'ADMIN'), async (req, res) => {
  try {
    const round = await prisma.round.findUnique({ where: { id: req.params.id } });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    if (req.user.role === 'INTERVIEWER' && round.interviewerId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    const snapshots = await prisma.codeSnapshot.findMany({
      where: { roundId: req.params.id },
      orderBy: { createdAt: 'asc' }
    });
    res.json(snapshots);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
