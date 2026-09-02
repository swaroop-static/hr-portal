import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', authorize('ADMIN', 'HR', 'MANAGER'), async (req, res) => {
  try {
    const where = req.user.role === 'MANAGER' ? { managerId: req.user.id } : {};
    const positions = await prisma.jobPosition.findMany({
      where,
      include: {
        manager: { select: { name: true, email: true } },
        _count: { select: { applications: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(positions);
  } catch (e) {
    console.error('list positions error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authorize('ADMIN', 'HR', 'MANAGER'), async (req, res) => {
  try {
    const position = await prisma.jobPosition.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { select: { name: true, email: true } },
        _count: { select: { applications: true } }
      }
    });
    if (!position) return res.status(404).json({ error: 'Not found' });
    res.json(position);
  } catch (e) {
    console.error('get position error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const { title, description, department, vacancies } = req.body;
    const position = await prisma.jobPosition.create({
      data: { title, description, department, vacancies: vacancies || 1, managerId: req.user.id }
    });
    res.status(201).json(position);
  } catch (e) {
    console.error('create position error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const { title, description, department, vacancies, status } = req.body;
    const position = await prisma.jobPosition.findUnique({ where: { id: req.params.id } });
    if (!position) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'MANAGER' && position.managerId !== req.user.id) {
      return res.status(403).json({ error: 'You can only modify your own positions' });
    }
    const updated = await prisma.jobPosition.update({
      where: { id: req.params.id },
      data: { title, description, department, vacancies, status }
    });
    res.json(updated);
  } catch (e) {
    console.error('update position error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authorize('MANAGER', 'ADMIN'), async (req, res) => {
  try {
    const position = await prisma.jobPosition.findUnique({ where: { id: req.params.id } });
    if (!position) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'MANAGER' && position.managerId !== req.user.id) {
      return res.status(403).json({ error: 'You can only modify your own positions' });
    }
    await prisma.jobPosition.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    console.error('delete position error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
