import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// Log an event (interviewer, candidate, HR, admin)
router.post('/:roundId/events', authorize('INTERVIEWER', 'CANDIDATE', 'HR', 'ADMIN'), async (req, res) => {
  try {
    const { eventType, actorRole, actorName, metadata } = req.body;
    if (!eventType || !actorRole) return res.status(400).json({ error: 'eventType and actorRole required' });

    // Verify round access
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      include: { application: { select: { candidateEmail: true } } }
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    const isInterviewer = round.interviewerId === req.user.id;
    const isCandidate = req.user.role === 'CANDIDATE' &&
      round.application?.candidateEmail?.toLowerCase() === req.user.email?.toLowerCase();
    if (!isInterviewer && !isCandidate && !['HR', 'ADMIN'].includes(req.user.role))
      return res.status(403).json({ error: 'Access denied' });

    const event = await prisma.interviewEvent.create({
      data: {
        roundId: req.params.roundId,
        eventType,
        actorRole,
        actorName: actorName || null,
        metadata: metadata ? JSON.stringify(metadata) : null
      }
    });
    res.status(201).json(event);
  } catch (e) {
    console.error('log event error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all events for a round
router.get('/:roundId/events', authorize('INTERVIEWER', 'HR', 'ADMIN'), async (req, res) => {
  try {
    const round = await prisma.round.findUnique({
      where: { id: req.params.roundId },
      select: { interviewerId: true }
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    if (req.user.role === 'INTERVIEWER' && round.interviewerId !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    const events = await prisma.interviewEvent.findMany({
      where: { roundId: req.params.roundId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(events);
  } catch (e) {
    console.error('get events error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Toggle bookmark on an event (interviewer, HR, admin)
router.put('/:roundId/events/:eventId/bookmark', authorize('INTERVIEWER', 'HR', 'ADMIN'), async (req, res) => {
  try {
    const { bookmarked, bookmarkNote } = req.body;
    const event = await prisma.interviewEvent.findUnique({ where: { id: req.params.eventId } });
    if (!event || event.roundId !== req.params.roundId) return res.status(404).json({ error: 'Event not found' });

    const updated = await prisma.interviewEvent.update({
      where: { id: req.params.eventId },
      data: {
        bookmarked: bookmarked ?? !event.bookmarked,
        bookmarkNote: bookmarkNote !== undefined ? bookmarkNote : event.bookmarkNote
      }
    });
    res.json(updated);
  } catch (e) {
    console.error('bookmark error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
