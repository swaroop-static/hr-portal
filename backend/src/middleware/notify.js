import { prisma, io } from '../index.js';
import { sendNotificationEmail } from '../email.js';

export async function notifyUser({ userId, type, title, body, link, emailContext } = {}) {
  try {
    const notification = await prisma.notification.create({
      data: { userId, type, title, body: body || '', link: link || null }
    });
    io.to(`user-${userId}`).emit('notification', notification);

    // Send email when emailContext is provided (fire-and-forget, never crashes)
    if (emailContext !== undefined) {
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
        .then(user => {
          if (user?.email) {
            sendNotificationEmail({ to: user.email, name: user.name, type, title, body, link, emailContext })
              .catch(() => {});
          }
        }).catch(() => {});
    }
  } catch (e) {
    console.error('[notify]', e.message);
  }
}

export async function notifyUsers(users, payload) {
  for (const userId of users) {
    notifyUser({ ...payload, userId }).catch(() => {});
  }
}
