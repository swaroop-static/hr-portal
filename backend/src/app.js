import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import positionRoutes from './routes/positions.js';
import applicationRoutes from './routes/applications.js';
import roundRoutes from './routes/rounds.js';
import testRoutes from './routes/tests.js';
import runCodeRoutes from './routes/runCode.js';
import analyticsRoutes from './routes/analytics.js';
import questionRoutes from './routes/questions.js';
import templateRoutes from './routes/templates.js';
import auditRoutes from './routes/audit.js';
import codeReplayRoutes from './routes/codeReplay.js';
import interviewEventRoutes from './routes/interviewEvents.js';
import notificationRoutes from './routes/notifications.js';

// Crash early if JWT_SECRET is not explicitly set (skip in test environment)
const SECRET = process.env.JWT_SECRET;
if (!SECRET && process.env.NODE_ENV !== 'test') {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export const app = express();
const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});
export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL || 'file:./hr_portal.db' }
  }
});

// ── Security headers ──────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow webcam/WebRTC
}));
app.use(cors());
app.use(express.json({ limit: '1mb' })); // Prevent oversized payloads

// ── Rate limiting ─────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,                   // 15 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200, // 200 requests/minute per IP for regular API
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// ── Static uploads (resumes) ──────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Routes ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/positions', positionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/rounds', runCodeRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/rounds', codeReplayRoutes);
app.use('/api/rounds', interviewEventRoutes);
app.use('/api/notifications', notificationRoutes);

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── WebSocket: authenticate on handshake ──────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  // Candidate test page connects without auth for the proctor side view — allowed with role check
  if (!token) {
    // Allow unauthenticated connections but mark as guest
    socket.data.user = null;
    return next();
  }
  try {
    socket.data.user = jwt.verify(token, SECRET);
    next();
  } catch {
    // Still allow connection but mark as unauthenticated (proctoring is best-effort)
    socket.data.user = null;
    next();
  }
});

io.on('connection', (socket) => {
  // Join personal notification room so notify.js can push to this user
  if (socket.data.user?.id) {
    socket.join(`user-${socket.data.user.id}`);
  }

  socket.on('join-proctor-room', ({ attemptId }) => {
    // Only HR, ADMIN, or INTERVIEWER can join as proctor
    const user = socket.data.user;
    if (user && ['HR', 'ADMIN', 'INTERVIEWER'].includes(user.role)) {
      socket.join(`proctor-${attemptId}`);
    } else if (!user) {
      socket.join(`proctor-${attemptId}`);
    }
    // Ask candidate to re-send their WebRTC signal so proctor can connect
    socket.to(`candidate-${attemptId}`).emit('proctor-joined', {});
  });

  socket.on('join-candidate-room', ({ attemptId }) => {
    socket.join(`candidate-${attemptId}`);
    socket.data.attemptId = attemptId;
    // If proctor already connected, tell the candidate immediately
    const proctorRoom = io.sockets.adapter.rooms.get(`proctor-${attemptId}`);
    if (proctorRoom && proctorRoom.size > 0) {
      socket.emit('proctor-joined', {});
    }
  });

  socket.on('candidate-video-signal', ({ attemptId, signal }) => {
    socket.to(`proctor-${attemptId}`).emit('candidate-video-signal', { signal });
  });

  socket.on('hr-video-signal', ({ attemptId, signal }) => {
    socket.to(`candidate-${attemptId}`).emit('hr-video-signal', { signal });
  });

  // Tab-switch counting is handled exclusively via HTTP (POST /attempt/:token/tab-switch).
  // This socket handler only forwards the proctor notification emitted by that HTTP route.
  socket.on('proctor-tab-switch-notify', ({ attemptId, tabSwitches }) => {
    io.to(`proctor-${attemptId}`).emit('tab-switch-alert', { tabSwitches });
  });

  // Relay webcam screenshot from candidate to proctor room
  socket.on('candidate-screenshot', ({ attemptId, image }) => {
    socket.to(`proctor-${attemptId}`).emit('candidate-screenshot', { image });
  });

  // ── Interview room: two-way audio via WebRTC signaling ───
  socket.on('join-interview-room', ({ roundId }) => {
    socket.join(`interview-${roundId}`);
    socket.to(`interview-${roundId}`).emit('interview-peer-joined');
    // If someone was already waiting, also notify the new joiner so the interviewer
    // can create the offer regardless of join order.
    const room = io.sockets.adapter.rooms.get(`interview-${roundId}`);
    if (room && room.size > 1) {
      socket.emit('interview-peer-joined');
    }
  });
  socket.on('interview-offer', ({ roundId, offer }) => {
    socket.to(`interview-${roundId}`).emit('interview-offer', { offer });
  });
  socket.on('interview-answer', ({ roundId, answer }) => {
    socket.to(`interview-${roundId}`).emit('interview-answer', { answer });
  });
  socket.on('interview-ice', ({ roundId, candidate }) => {
    socket.to(`interview-${roundId}`).emit('interview-ice', { candidate });
  });
  socket.on('interview-leave', ({ roundId }) => {
    socket.to(`interview-${roundId}`).emit('interview-peer-left');
    socket.leave(`interview-${roundId}`);
  });

  // In-call text chat relay
  socket.on('interview-chat', ({ roundId, message, senderName, timestamp }) => {
    socket.to(`interview-${roundId}`).emit('interview-chat', { message, senderName, timestamp });
  });

  // Real-time code sync (candidate → interviewer)
  socket.on('interview-code-sync', ({ roundId, code, language }) => {
    socket.to(`interview-${roundId}`).emit('interview-code-sync', { code, language });
  });

  // Problem statement sync (interviewer → candidate)
  socket.on('interview-code-problem', ({ roundId, problem }) => {
    socket.to(`interview-${roundId}`).emit('interview-code-problem', { problem });
  });

  // Interviewer signals end of interview to candidate
  socket.on('interview-end', ({ roundId }) => {
    socket.to(`interview-${roundId}`).emit('interview-ended');
  });

  // Whiteboard sync — full canvas snapshot on stroke end (kept for backward compat)
  socket.on('interview-whiteboard-sync', ({ roundId, imageData }) => {
    socket.to(`interview-${roundId}`).emit('interview-whiteboard-sync', { imageData });
  });
  // Whiteboard vector stroke relay
  socket.on('interview-whiteboard-stroke', ({ roundId, stroke }) => {
    socket.to(`interview-${roundId}`).emit('interview-whiteboard-stroke', { stroke });
  });
  // Whiteboard full strokes list relay (used for undo and late-join sync)
  socket.on('interview-whiteboard-strokes-sync', ({ roundId, strokes }) => {
    socket.to(`interview-${roundId}`).emit('interview-whiteboard-strokes-sync', { strokes });
  });
  // Whiteboard clear
  socket.on('interview-whiteboard-clear', ({ roundId }) => {
    socket.to(`interview-${roundId}`).emit('interview-whiteboard-clear');
  });
});

export { httpServer };
