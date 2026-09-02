import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// List all users (HR can list for assignment dropdowns, ADMIN for management)
router.get('/', authorize('ADMIN', 'HR', 'MANAGER'), async (req, res) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role) where.role = role;
    const users = await prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
    });
    res.json(users);
  } catch (e) {
    console.error('list users error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (ADMIN only — HR creates candidates via /applications route)
router.post('/', authorize('ADMIN'), async (req, res) => {
  try {
    const { email, password, name, role } = req.body;
    const VALID_ROLES = ['ADMIN', 'HR', 'MANAGER', 'INTERVIEWER', 'CANDIDATE'];
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), password: hashed, name, role },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
    });
    res.status(201).json(user);
  } catch (e) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'Email already exists' });
    console.error('create user error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update / Delete — ADMIN only
router.put('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    const { name, email, role, isActive, password } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email.toLowerCase();
    if (role !== undefined) data.role = role;
    if (isActive !== undefined) data.isActive = isActive;
    if (password) data.password = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true }
    });
    res.json(user);
  } catch (e) {
    console.error('update user error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete user (ADMIN only)
router.delete('/:id', authorize('ADMIN'), async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    console.error('delete user error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
