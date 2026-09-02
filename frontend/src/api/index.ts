import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('hr_portal_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/test/')) {
      localStorage.removeItem('hr_portal_token');
      localStorage.removeItem('hr_portal_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const loginUser = (email: string, password: string) =>
  api.post('/auth/login', { email: email.toLowerCase(), password }).then(r => r.data);
export const getMe = () => api.get('/auth/me').then(r => r.data);

// Users (admin/hr)
export const getUsers = (role?: string) =>
  api.get('/users', { params: role ? { role } : {} }).then(r => r.data);
export const createUser = (data: any) => api.post('/users', data).then(r => r.data);
export const updateUser = (id: string, data: any) => api.put(`/users/${id}`, data).then(r => r.data);
export const deleteUser = (id: string) => api.delete(`/users/${id}`).then(r => r.data);

// Positions
export const getPositions = () => api.get('/positions').then(r => r.data);
export const createPosition = (data: any) => api.post('/positions', data).then(r => r.data);
export const updatePosition = (id: string, data: any) => api.put(`/positions/${id}`, data).then(r => r.data);
export const deletePosition = (id: string) => api.delete(`/positions/${id}`).then(r => r.data);

// Applications
export const getApplications = (positionId?: string) =>
  api.get('/applications', { params: positionId ? { positionId } : {} }).then(r => r.data);
export const getApplicationsPaginated = (page: number, limit = 20, positionId?: string) =>
  api.get('/applications', { params: { page, limit, ...(positionId ? { positionId } : {}) } })
    .then(r => r.data as { data: any[]; total: number; page: number; totalPages: number });
export const createApplication = (data: any) => api.post('/applications', data).then(r => r.data);
export const getApplication = (id: string) => api.get(`/applications/${id}`).then(r => r.data);
export const updateApplication = (id: string, data: any) => api.put(`/applications/${id}`, data).then(r => r.data);
export const deleteApplication = (id: string) => api.delete(`/applications/${id}`).then(r => r.data);
export const uploadResume = (id: string, file: File) => {
  const fd = new FormData();
  fd.append('resume', file);
  return api.post(`/applications/${id}/resume`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};

// Rounds
export const createRound = (data: any) => api.post('/rounds', data).then(r => r.data);
export const updateRound = (id: string, data: any) => api.put(`/rounds/${id}`, data).then(r => r.data);
export const getRoundsByApplication = (applicationId: string) =>
  api.get(`/rounds/application/${applicationId}`).then(r => r.data);
export const getRoundForInterview = (roundId: string) =>
  api.get(`/rounds/${roundId}/interview-room`).then(r => r.data);
export const updateLiveNotes = (id: string, liveNotes: string) =>
  api.put(`/rounds/${id}/live-notes`, { liveNotes }).then(r => r.data);
export const runCode = (id: string, code: string, language: string) =>
  api.post(`/rounds/${id}/run-code`, { code, language }).then(r => r.data);
export const getMyRounds = () => api.get('/rounds/interviewer/mine').then(r => r.data);
export const getCandidateMyTest = () => api.get('/rounds/candidate/my-test').then(r => r.data as { activeTests: any[]; pastTests: any[] });
export const submitScorecard = (id: string, scorecard: any) =>
  api.put(`/rounds/${id}/scorecard`, { scorecard }).then(r => r.data);
export const saveRoundSession = (id: string, data: { code?: string; language?: string; chatHistory?: any[]; canvas?: string; timerStart?: string }) =>
  api.put(`/rounds/${id}/session`, data).then(r => r.data);

// Tests
export const getTests = () => api.get('/tests').then(r => r.data);
export const getTestsPaginated = (page: number, limit = 20) =>
  api.get('/tests', { params: { page, limit } })
    .then(r => r.data as { data: any[]; total: number; page: number; totalPages: number });
export const createTest = (data: any) => api.post('/tests', data).then(r => r.data);
export const getTest = (id: string) => api.get(`/tests/${id}`).then(r => r.data);
export const deleteTest = (id: string) => api.delete(`/tests/${id}`).then(r => r.data);
export const generateTestLink = (testId: string, data: any) =>
  api.post(`/tests/${testId}/generate-link`, data).then(r => r.data);

// Test attempt (candidate — uses auth token)
export const getAttemptByToken = (token: string) =>
  api.get(`/tests/attempt/${token}`).then(r => r.data);
export const startAttempt = (token: string) =>
  api.post(`/tests/attempt/${token}/start`).then(r => r.data);
export const submitAttempt = (token: string, responses: any) =>
  api.post(`/tests/attempt/${token}/submit`, { responses }).then(r => r.data);
export const reportTabSwitch = (token: string) =>
  api.post(`/tests/attempt/${token}/tab-switch`).then(r => r.data);
export const terminateAttempt = (token: string) =>
  api.post(`/tests/attempt/${token}/terminate`).then(r => r.data);
export const updateAttemptProctor = (token: string, proctorId: string | null) =>
  api.put(`/tests/attempt/${token}/proctor`, { proctorId }).then(r => r.data);
export const getMyProctorSessions = () =>
  api.get('/tests/proctor/mine').then(r => r.data);
export const getAttemptById = (id: string) =>
  api.get(`/tests/attempt/by-id/${id}`).then(r => r.data);
export const gradeAttempt = (id: string, grades: Record<string, { score: number; feedback: string }>) =>
  api.put(`/tests/attempt/${id}/grade`, { grades }).then(r => r.data);

// Analytics
export const getAnalyticsSummary = () => api.get('/analytics/summary').then(r => r.data);
export const getAnalyticsFunnel = () => api.get('/analytics/funnel').then(r => r.data);
export const getAnalyticsRoundsByType = () => api.get('/analytics/rounds-by-type').then(r => r.data);
export const getAnalyticsRecentActivity = () => api.get('/analytics/recent-activity').then(r => r.data);
export const getAnalyticsInterviewerStats = () => api.get('/analytics/interviewer-stats').then(r => r.data);

// Question Bank
export const getQuestions = (params?: { difficulty?: string; search?: string }) =>
  api.get('/questions', { params }).then(r => r.data);
export const createQuestion = (data: any) => api.post('/questions', data).then(r => r.data);
export const updateQuestion = (id: string, data: any) => api.put(`/questions/${id}`, data).then(r => r.data);
export const deleteQuestion = (id: string) => api.delete(`/questions/${id}`).then(r => r.data);

// Templates
export const getTemplates = () => api.get('/templates').then(r => r.data);
export const createTemplate = (data: any) => api.post('/templates', data).then(r => r.data);
export const updateTemplate = (id: string, data: any) => api.put(`/templates/${id}`, data).then(r => r.data);
export const deleteTemplate = (id: string) => api.delete(`/templates/${id}`).then(r => r.data);
export const applyTemplate = (templateId: string, applicationId: string) =>
  api.post(`/templates/${templateId}/apply`, { applicationId }).then(r => r.data);

// Audit log
export const getAuditLogs = (params?: { page?: number; limit?: number; entityType?: string; action?: string; search?: string }) =>
  api.get('/audit', { params }).then(r => r.data);

// Code replay
export const getCodeSnapshots = (roundId: string) =>
  api.get(`/rounds/${roundId}/snapshots`).then(r => r.data);

export const submitCandidateFeedback = (roundId: string, feedback: { respect: number; clarity: number; overall: number; comment: string }) =>
  api.put(`/rounds/${roundId}/candidate-feedback`, feedback).then(r => r.data);

export const getRound = (id: string) =>
  api.get(`/rounds/${id}`).then(r => r.data);

// Interview Events
export const logInterviewEvent = (roundId: string, data: { eventType: string; actorRole: string; actorName?: string; metadata?: Record<string, unknown> }) =>
  api.post(`/rounds/${roundId}/events`, data);
export const getInterviewEvents = (roundId: string) => api.get(`/rounds/${roundId}/events`);
export const toggleEventBookmark = (roundId: string, eventId: string, data: { bookmarked?: boolean; bookmarkNote?: string }) =>
  api.put(`/rounds/${roundId}/events/${eventId}/bookmark`, data);

// Notifications
export const getNotifications = () => api.get('/notifications').then(r => r.data as { notifications: any[]; unreadCount: number });
export const markNotificationRead = (id: string) => api.put(`/notifications/${id}/read`).then(r => r.data);
export const markAllNotificationsRead = () => api.put('/notifications/read-all').then(r => r.data);

// Analytics — manager summary + command center
export const getManagerSummary = () => api.get('/analytics/manager-summary').then(r => r.data);
export const getCommandCenter = () => api.get('/analytics/command-center').then(r => r.data);

export default api;
