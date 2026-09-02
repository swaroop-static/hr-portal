import { Router } from 'express';
import { prisma } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { logAudit } from '../middleware/audit.js';

const router = Router();
router.use(authenticate);

// List all templates
router.get('/', authorize('HR', 'ADMIN', 'MANAGER', 'INTERVIEWER'), async (req, res) => {
  try {
    const templates = await prisma.interviewTemplate.findMany({
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(templates);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create template
router.post('/', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { name, description, department, stages } = req.body;
    if (!name || !stages) return res.status(400).json({ error: 'name and stages are required' });
    const template = await prisma.interviewTemplate.create({
      data: { name, description, department, stages: JSON.stringify(stages), createdById: req.user.id },
      include: { createdBy: { select: { name: true } } }
    });
    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'TEMPLATE_CREATED', entityType: 'InterviewTemplate', entityId: template.id, after: { name }, ip: req.ip });
    res.status(201).json(template);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update template
router.put('/:id', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { name, description, department, stages } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (department !== undefined) data.department = department;
    if (stages !== undefined) data.stages = JSON.stringify(stages);
    const template = await prisma.interviewTemplate.update({
      where: { id: req.params.id },
      data,
      include: { createdBy: { select: { name: true } } }
    });
    res.json(template);
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Template not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete template
router.delete('/:id', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    await prisma.interviewTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (e) {
    if (e.code === 'P2025') return res.status(404).json({ error: 'Template not found' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Apply template to an application — creates rounds from stages
router.post('/:id/apply', authorize('HR', 'ADMIN'), async (req, res) => {
  try {
    const { applicationId } = req.body;
    if (!applicationId) return res.status(400).json({ error: 'applicationId is required' });

    const template = await prisma.interviewTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application) return res.status(404).json({ error: 'Application not found' });

    const stages = JSON.parse(template.stages);
    const rounds = await Promise.all(
      stages.map(stage =>
        prisma.round.create({
          data: {
            applicationId,
            type: stage.type,
            order: stage.order,
            interviewerId: stage.interviewerId || null,
            testId: stage.testId || null,
          }
        })
      )
    );

    // Set application to IN_PROGRESS if still PENDING
    await prisma.application.updateMany({
      where: { id: applicationId, status: 'PENDING' },
      data: { status: 'IN_PROGRESS' }
    });

    await logAudit({ userId: req.user.id, userEmail: req.user.email, action: 'TEMPLATE_APPLIED', entityType: 'Application', entityId: applicationId, after: { templateId: req.params.id, templateName: template.name, roundsCreated: rounds.length }, ip: req.ip });

    res.status(201).json({ rounds, template: { id: template.id, name: template.name } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
