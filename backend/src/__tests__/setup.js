import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(__dirname, '..', '..');
const TEST_DB_PATH = resolve(BACKEND_DIR, 'prisma', 'test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH.replace(/\\/g, '/')}`;

// DATABASE_URL, JWT_SECRET, etc. are set by globalSetup.js in the main process
// and inherited by this worker. We just confirm they're present here.
if (!process.env.DATABASE_URL) process.env.DATABASE_URL = TEST_DB_URL;

export const testDb = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } }
});

const TEST_PASSWORD = 'Test1234!';
const TEST_USERS = [
  { email: 'admin@test.com',       name: 'Test Admin',       role: 'ADMIN' },
  { email: 'hr@test.com',          name: 'Test HR',          role: 'HR' },
  { email: 'interviewer@test.com', name: 'Test Interviewer', role: 'INTERVIEWER' },
  { email: 'candidate@test.com',   name: 'Test Candidate',   role: 'CANDIDATE' },
  { email: 'manager@test.com',     name: 'Test Manager',     role: 'MANAGER' },
];

let seededUsers = {};

beforeAll(async () => {
  // Wipe all data in dependency order, then seed fresh test users
  await testDb.notification.deleteMany();
  await testDb.interviewEvent.deleteMany();
  await testDb.codeSnapshot.deleteMany();
  await testDb.testAttempt.deleteMany();
  await testDb.round.deleteMany();
  await testDb.application.deleteMany();
  await testDb.jobPosition.deleteMany();
  await testDb.auditLog.deleteMany();
  await testDb.interviewQuestion.deleteMany();
  await testDb.interviewTemplate.deleteMany();
  await testDb.question.deleteMany();
  await testDb.test.deleteMany();
  await testDb.user.deleteMany();

  const hashed = await bcrypt.hash(TEST_PASSWORD, 10);
  for (const u of TEST_USERS) {
    const user = await testDb.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, password: hashed },
      create: { email: u.email, name: u.name, role: u.role, password: hashed },
    });
    seededUsers[u.role] = user;
  }
}, 30000);

export function getToken(role) {
  const user = seededUsers[role];
  if (!user) throw new Error(`No seeded user found for role: ${role}`);
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    'test-secret-key',
    { expiresIn: '8h' }
  );
}

export function getUser(role) {
  return seededUsers[role];
}
