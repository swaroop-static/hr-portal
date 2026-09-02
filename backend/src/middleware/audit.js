import { prisma } from '../index.js';

export async function logAudit({ userId, userEmail, action, entityType, entityId, before, after, ip } = {}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        userEmail: userEmail ?? null,
        action,
        entityType,
        entityId,
        before: before != null ? JSON.stringify(before) : null,
        after: after != null ? JSON.stringify(after) : null,
        ip: ip ?? null,
      }
    });
  } catch (e) {
    console.error('[audit]', e.message);
  }
}
