import { Router } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { sendApplicationStatusUpdate } from '../email.js';
import { logAudit } from '../middleware/audit.js';
import { notifyUser, notifyUsers } from '../middleware/notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', '..', 'uploads', 'resumes'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

const router = Router();
router.use(authenticate, authorize('HR', 'MANAGER', 'ADMIN'));

router.get('/', async (req, res) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    let where = req.query.positionId ? { positionId: req.query.positionId } : {};
    // If manager, scope to their positions only
    if (req.user.role === 'MANAGER') {
      const managerPositions = await prisma.jobPosition.findMany({
        where: { managerId: req.user.id },
        select: { id: true }
      });
      const positionIds = managerPositions.map(p => p.id);
      where = { ...where, positionId: { in: positionIds } };
    }

    if (page !== null) {
      const [applications, total] = await Promise.all([
        prisma.application.findMany({
          where,
          include: {
            position: { select: { title: true, department: true } },
            _count: { select: { rounds: true } }
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.application.count({ where })
      ]);
      const safeApplications = applications.map(a => { const { candidatePassword, ...rest } = a; return rest; });
      return res.json({ data: safeApplications, total, page, totalPages: Math.ceil(total / limit) });
    }

    const applications = await prisma.application.findMany({
      where,
      include: {
        position: { select: { title: true, department: true } },
        _count: { select: { rounds: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const safeApplications = applications.map(a => { const { candidatePassword, ...rest } = a; return rest; });
    res.json(safeApplications);
  } catch (e) {
    console.error('list applications error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const application = await prisma.application.findUnique({
      where: { id: req.params.id },
      include: {
        position: { select: { title: true, department: true, managerId: true } },
        rounds: {
          include: {
            interviewer: { select: { name: true, email: true } },
            test: { select: { id: true, title: true, duration: true } },
            testAttempt: {
              include: { proctor: { select: { name: true, email: true } } }
            }
          },
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!application) return res.status(404).json({ error: 'Not found' });
    if (req.user.role === 'MANAGER' && application.position?.managerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    // HR and ADMIN can see the password to share with candidates; MANAGER cannot
    if (!['HR', 'ADMIN'].includes(req.user.role)) {
      const { candidatePassword, ...safeApplication } = application;
      return res.json(safeApplication);
    }
    res.json(application);
  } catch (e) {
    console.error('get application error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { candidateName, candidateEmail, positionId, candidatePassword } = req.body;
    if (!candidateName || typeof candidateName !== 'string' || !candidateName.trim()) {
      return res.status(400).json({ error: 'Candidate name is required' });
    }
    if (!candidateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
      return res.status(400).json({ error: 'Valid candidate email is required' });
    }
    if (!positionId) {
      return res.status(400).json({ error: 'Position is required' });
    }
    if (candidatePassword && (typeof candidatePassword !== 'string' || candidatePassword.length < 6)) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const normalizedEmail = candidateEmail.toLowerCase();

    // Duplicate check
    const duplicate = await prisma.application.findFirst({
      where: { candidateEmail: normalizedEmail, positionId }
    });
    if (duplicate) {
      return res.status(400).json({ error: 'Candidate already applied for this position' });
    }

    const position = await prisma.jobPosition.findUnique({ where: { id: positionId } });
    if (!position) return res.status(400).json({ error: 'Position not found' });

    // Create candidate user account if password provided
    if (candidatePassword) {
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (!existing) {
        const hashed = await bcrypt.hash(candidatePassword, 10);
        await prisma.user.create({
          data: { email: normalizedEmail, password: hashed, name: candidateName, role: 'CANDIDATE' }
        });
      }
    }

    const application = await prisma.application.create({
      data: {
        candidateName,
        candidateEmail: normalizedEmail,
        candidatePassword: candidatePassword || null,
        positionId
      },
      include: { position: { select: { title: true } } }
    });
    const { candidatePassword: _pw, ...safeCreated } = application;
    res.status(201).json(safeCreated);

    // Notify all HR and ADMIN users about new application (fire-and-forget)
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    prisma.user.findMany({
      where: { role: { in: ['HR', 'ADMIN'] }, isActive: true },
      select: { id: true }
    }).then(hrAdmins => {
      notifyUsers(hrAdmins.map(u => u.id), {
        type: 'APPLICATION_RECEIVED',
        title: 'New Application',
        body: `${candidateName} applied for ${application.position?.title || 'a position'}`,
        link: `${baseUrl}/hr/applications/${application.id}`
      }).catch(() => {});
    }).catch(() => {});
  } catch (e) {
    console.error('create application error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { status, notes, candidatePassword } = req.body;

    // Fetch existing application before update (for audit log and password update)
    const existingApp = await prisma.application.findUnique({ where: { id: req.params.id }, select: { status: true, candidateEmail: true } });

    const data = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (candidatePassword !== undefined) {
      data.candidatePassword = candidatePassword || null;
      // Also update the candidate user account password if they have one
      if (candidatePassword) {
        const app = await prisma.application.findUnique({ where: { id: req.params.id } });
        if (app) {
          const user = await prisma.user.findUnique({ where: { email: app.candidateEmail } });
          if (user) {
            const hashed = await bcrypt.hash(candidatePassword, 10);
            await prisma.user.update({ where: { email: app.candidateEmail }, data: { password: hashed } });
          }
        }
      }
    }
    const application = await prisma.application.update({
      where: { id: req.params.id },
      data,
      include: { position: { select: { title: true } } }
    });
    res.json(application);

    // Audit log for status changes
    if (status !== undefined && existingApp && existingApp.status !== status) {
      logAudit({
        userId: req.user.id, userEmail: req.user.email,
        action: 'APPLICATION_STATUS_CHANGED',
        entityType: 'Application', entityId: req.params.id,
        before: { status: existingApp.status }, after: { status },
        ip: req.ip
      }).catch(() => {});
    }

    // Fire email non-blocking after response is sent
    if (status && ['SELECTED', 'REJECTED', 'IN_PROGRESS'].includes(status)) {
      sendApplicationStatusUpdate({
        candidateName: application.candidateName,
        candidateEmail: application.candidateEmail,
        positionTitle: application.position?.title || 'the position',
        status,
      }).catch(() => {});
    }
  } catch (e) {
    console.error('update application error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    await prisma.application.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    console.error('delete application error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/resume', authorize('HR', 'ADMIN'), (req, res) => {
  upload.single('resume')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
      const updated = await prisma.application.update({
        where: { id: req.params.id },
        data: { resumePath: `/uploads/resumes/${req.file.filename}`, resumeName: req.file.originalname },
      });
      res.json({ resumePath: updated.resumePath, resumeName: updated.resumeName });
    } catch (e) {
      console.error('resume upload error:', e);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

export default router;
