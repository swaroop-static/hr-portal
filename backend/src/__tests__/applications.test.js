import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { getToken, getUser, testDb } from './setup.js';

let testPositionId;
let testApplicationId;

beforeAll(async () => {
  const manager = getUser('MANAGER');
  const position = await testDb.jobPosition.create({
    data: {
      title: 'Test Engineer',
      description: 'Test position for applications suite',
      department: 'Engineering',
      vacancies: 2,
      managerId: manager.id,
      status: 'OPEN',
    },
  });
  testPositionId = position.id;
});

afterAll(async () => {
  // Clean up applications first (they reference position)
  await testDb.application.deleteMany({ where: { positionId: testPositionId } });
  await testDb.jobPosition.delete({ where: { id: testPositionId } }).catch(() => {});
});

describe('GET /api/applications', () => {
  it('returns 200 with array as HR', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${getToken('HR')}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns paginated response when page and limit are provided', async () => {
    const res = await request(app)
      .get('/api/applications?page=1&limit=5')
      .set('Authorization', `Bearer ${getToken('HR')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('returns 403 for CANDIDATE role', async () => {
    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${getToken('CANDIDATE')}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/applications', () => {
  it('creates an application as HR and returns 201', async () => {
    const res = await request(app)
      .post('/api/applications')
      .set('Authorization', `Bearer ${getToken('HR')}`)
      .send({
        candidateName: 'Jane Doe',
        candidateEmail: 'jane.doe.test@example.com',
        positionId: testPositionId,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.candidateName).toBe('Jane Doe');
    testApplicationId = res.body.id;
  });
});

describe('GET /api/applications/:id', () => {
  it('returns application with rounds as HR', async () => {
    // Ensure we have an application to fetch
    if (!testApplicationId) {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${getToken('HR')}`)
        .send({
          candidateName: 'Test Fetch',
          candidateEmail: 'testfetch.apps@example.com',
          positionId: testPositionId,
        });
      testApplicationId = res.body.id;
    }

    const res = await request(app)
      .get(`/api/applications/${testApplicationId}`)
      .set('Authorization', `Bearer ${getToken('HR')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', testApplicationId);
    expect(res.body).toHaveProperty('rounds');
    expect(Array.isArray(res.body.rounds)).toBe(true);
  });
});

describe('PUT /api/applications/:id', () => {
  it('updates application status to REJECTED as HR', async () => {
    // Ensure we have an application
    if (!testApplicationId) {
      const res = await request(app)
        .post('/api/applications')
        .set('Authorization', `Bearer ${getToken('HR')}`)
        .send({
          candidateName: 'Update Test',
          candidateEmail: 'updatetest.apps@example.com',
          positionId: testPositionId,
        });
      testApplicationId = res.body.id;
    }

    const res = await request(app)
      .put(`/api/applications/${testApplicationId}`)
      .set('Authorization', `Bearer ${getToken('HR')}`)
      .send({ status: 'REJECTED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('REJECTED');
  });
});

describe('Role scoping for MANAGER', () => {
  it('MANAGER only sees applications for their own positions', async () => {
    // Create a second position under a different manager (admin user as stand-in)
    const admin = getUser('ADMIN');
    const otherPosition = await testDb.jobPosition.create({
      data: {
        title: 'Other Position',
        description: 'Not owned by manager',
        department: 'HR',
        vacancies: 1,
        managerId: admin.id,
        status: 'OPEN',
      },
    });

    // Create application under other position
    await testDb.application.create({
      data: {
        candidateName: 'Other Candidate',
        candidateEmail: 'other.scope@example.com',
        positionId: otherPosition.id,
      },
    });

    const res = await request(app)
      .get('/api/applications')
      .set('Authorization', `Bearer ${getToken('MANAGER')}`);

    expect(res.status).toBe(200);
    const apps = Array.isArray(res.body) ? res.body : res.body.data;
    // Manager should only see apps for their own positions
    const managerUser = getUser('MANAGER');
    for (const app of apps) {
      // All returned applications must belong to a position owned by this manager
      // We verify by checking positionId is our testPositionId (manager-owned)
      expect(app.positionId).not.toBe(otherPosition.id);
    }

    // Cleanup
    await testDb.application.deleteMany({ where: { positionId: otherPosition.id } });
    await testDb.jobPosition.delete({ where: { id: otherPosition.id } });
  });
});
