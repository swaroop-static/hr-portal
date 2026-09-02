import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { getToken, getUser, testDb } from './setup.js';

let testPositionId;
let testApplicationId;
let testRoundId;

beforeAll(async () => {
  const manager = getUser('MANAGER');
  const interviewer = getUser('INTERVIEWER');

  // Create a position
  const position = await testDb.jobPosition.create({
    data: {
      title: 'Backend Developer',
      description: 'Rounds test position',
      department: 'Engineering',
      vacancies: 1,
      managerId: manager.id,
      status: 'OPEN',
    },
  });
  testPositionId = position.id;

  // Create an application
  const application = await testDb.application.create({
    data: {
      candidateName: 'Round Tester',
      candidateEmail: 'roundtester@example.com',
      positionId: testPositionId,
    },
  });
  testApplicationId = application.id;
});

afterAll(async () => {
  // Delete rounds, then application, then position
  await testDb.round.deleteMany({ where: { applicationId: testApplicationId } });
  await testDb.application.delete({ where: { id: testApplicationId } }).catch(() => {});
  await testDb.jobPosition.delete({ where: { id: testPositionId } }).catch(() => {});
});

describe('POST /api/rounds', () => {
  it('creates a round as HR and returns 201', async () => {
    const interviewer = getUser('INTERVIEWER');
    const res = await request(app)
      .post('/api/rounds')
      .set('Authorization', `Bearer ${getToken('HR')}`)
      .send({
        applicationId: testApplicationId,
        type: 'HR_INTERVIEW',
        order: 1,
        interviewerId: interviewer.id,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.type).toBe('HR_INTERVIEW');
    testRoundId = res.body.id;
  });

  it('returns 400 when interviewerId is missing for TECHNICAL_INTERVIEW', async () => {
    const res = await request(app)
      .post('/api/rounds')
      .set('Authorization', `Bearer ${getToken('HR')}`)
      .send({
        applicationId: testApplicationId,
        type: 'TECHNICAL_INTERVIEW',
        order: 2,
        // No interviewerId
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /api/rounds/:id', () => {
  it('returns round as INTERVIEWER for their own round', async () => {
    // Ensure we have a round
    if (!testRoundId) {
      const interviewer = getUser('INTERVIEWER');
      const r = await request(app)
        .post('/api/rounds')
        .set('Authorization', `Bearer ${getToken('HR')}`)
        .send({ applicationId: testApplicationId, type: 'HR_INTERVIEW', order: 1, interviewerId: interviewer.id });
      testRoundId = r.body.id;
    }

    const res = await request(app)
      .get(`/api/rounds/${testRoundId}`)
      .set('Authorization', `Bearer ${getToken('INTERVIEWER')}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id', testRoundId);
  });

  it('returns 403 for CANDIDATE who is not associated with the round', async () => {
    if (!testRoundId) {
      const interviewer = getUser('INTERVIEWER');
      const r = await request(app)
        .post('/api/rounds')
        .set('Authorization', `Bearer ${getToken('HR')}`)
        .send({ applicationId: testApplicationId, type: 'HR_INTERVIEW', order: 1, interviewerId: interviewer.id });
      testRoundId = r.body.id;
    }

    const res = await request(app)
      .get(`/api/rounds/${testRoundId}`)
      .set('Authorization', `Bearer ${getToken('CANDIDATE')}`);

    // candidate@test.com is not associated with this round's application
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/rounds/:id', () => {
  it('updates round status to PASSED as HR', async () => {
    if (!testRoundId) {
      const interviewer = getUser('INTERVIEWER');
      const r = await request(app)
        .post('/api/rounds')
        .set('Authorization', `Bearer ${getToken('HR')}`)
        .send({ applicationId: testApplicationId, type: 'HR_INTERVIEW', order: 1, interviewerId: interviewer.id });
      testRoundId = r.body.id;
    }

    const res = await request(app)
      .put(`/api/rounds/${testRoundId}`)
      .set('Authorization', `Bearer ${getToken('HR')}`)
      .send({ status: 'PASSED' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('PASSED');
  });
});

describe('PUT /api/rounds/:id/session', () => {
  it('saves session data as INTERVIEWER', async () => {
    if (!testRoundId) {
      const interviewer = getUser('INTERVIEWER');
      const r = await request(app)
        .post('/api/rounds')
        .set('Authorization', `Bearer ${getToken('HR')}`)
        .send({ applicationId: testApplicationId, type: 'HR_INTERVIEW', order: 1, interviewerId: interviewer.id });
      testRoundId = r.body.id;
    }

    const res = await request(app)
      .put(`/api/rounds/${testRoundId}/session`)
      .set('Authorization', `Bearer ${getToken('INTERVIEWER')}`)
      .send({ code: 'console.log("hello")', language: 'javascript' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

describe('Application status after round FAILED', () => {
  it('sets application status to REJECTED when round is FAILED', async () => {
    const interviewer = getUser('INTERVIEWER');

    // Create a fresh application for this test
    const freshApp = await testDb.application.create({
      data: {
        candidateName: 'Fail Tester',
        candidateEmail: 'failtester@example.com',
        positionId: testPositionId,
      },
    });

    // Create a round for it
    const roundRes = await request(app)
      .post('/api/rounds')
      .set('Authorization', `Bearer ${getToken('HR')}`)
      .send({
        applicationId: freshApp.id,
        type: 'HR_INTERVIEW',
        order: 1,
        interviewerId: interviewer.id,
      });
    expect(roundRes.status).toBe(201);
    const roundId = roundRes.body.id;

    // Fail the round
    const updateRes = await request(app)
      .put(`/api/rounds/${roundId}`)
      .set('Authorization', `Bearer ${getToken('HR')}`)
      .send({ status: 'FAILED' });
    expect(updateRes.status).toBe(200);

    // Check application was auto-rejected
    const updatedApp = await testDb.application.findUnique({ where: { id: freshApp.id } });
    expect(updatedApp.status).toBe('REJECTED');

    // Cleanup
    await testDb.round.delete({ where: { id: roundId } });
    await testDb.application.delete({ where: { id: freshApp.id } });
  });
});
