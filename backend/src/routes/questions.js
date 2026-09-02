import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authenticate);

router.get('/', authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const { difficulty, search } = req.query;
    const where = {};
    if (difficulty) where.difficulty = difficulty;
    if (search) where.title = { contains: search };
    const questions = await prisma.interviewQuestion.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } }
    });
    res.json(questions);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const { title, description, difficulty, tags, hints, solution } = req.body;
    if (!title || !description) return res.status(400).json({ error: 'title and description are required' });
    const q = await prisma.interviewQuestion.create({
      data: { id: randomUUID(), title, description, difficulty: difficulty || 'MEDIUM', tags: tags ? JSON.stringify(tags) : null, hints, solution, createdById: req.user.id }
    });
    res.status(201).json(q);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authorize('HR', 'ADMIN', 'INTERVIEWER'), async (req, res) => {
  try {
    const { title, description, difficulty, tags, hints, solution } = req.body;
    const q = await prisma.interviewQuestion.update({
      where: { id: req.params.id },
      data: { ...(title && { title }), ...(description && { description }), ...(difficulty && { difficulty }), ...(tags !== undefined && { tags: JSON.stringify(tags) }), ...(hints !== undefined && { hints }), ...(solution !== undefined && { solution }) }
    });
    res.json(q);
  } catch (e) { if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' }); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    await prisma.interviewQuestion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) { if (e.code === 'P2025') return res.status(404).json({ error: 'Not found' }); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
