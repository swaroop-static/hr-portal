# HR Recruitment Portal — CLAUDE.md

## Project Overview

Full-stack HR recruitment platform with role-based access, multi-round interview management, proctored assessments, real-time WebRTC video interviews, collaborative live coding, whiteboard, analytics, question bank, interview templates, structured scorecards, audit logging, code replay, interview event timeline, in-app + email notifications, calendar invites (.ics), live hiring Command Center, server-side session recovery, and a Vitest API test suite. Comparable to HackerRank CodePair / CoderPad in interview capabilities.

## Architecture

```
portal/
├── backend/          # Express.js API server
│   ├── src/
│   │   ├── index.js              # Thin launcher — imports app.js, calls httpServer.listen(); re-exports prisma + io
│   │   ├── app.js                # All server logic: middleware, routes, Socket.io; exports { app, httpServer, io, prisma }
│   │   ├── seed.js               # Database seeding
│   │   ├── email.js              # nodemailer — all email templates + .ics calendar invite generation
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT auth + RBAC middleware
│   │   │   ├── audit.js          # logAudit() helper — writes AuditLog records
│   │   │   └── notify.js         # notifyUser() / notifyUsers() — DB record + Socket.io push + optional email
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── users.js
│   │       ├── positions.js
│   │       ├── applications.js   # logAudit on APPLICATION_STATUS_CHANGED; notifyUsers on new application
│   │       ├── rounds.js         # /scorecard, /candidate-feedback, /live-notes, /session; notifyUser on assign + result
│   │       ├── tests.js          # INTERVIEWER ownership check on attempt access
│   │       ├── runCode.js        # Docker sandbox + ALLOW_DIRECT_EXECUTION fallback
│   │       ├── analytics.js      # 7 analytics endpoints (incl. manager-summary, command-center)
│   │       ├── questions.js      # Interview question bank CRUD
│   │       ├── templates.js      # Pipeline templates CRUD + apply
│   │       ├── audit.js          # Audit log viewer (ADMIN)
│   │       ├── codeReplay.js     # Code snapshot history per round
│   │       ├── interviewEvents.js # Interview event timeline + bookmarks
│   │       └── notifications.js  # GET /notifications, PUT /:id/read, PUT /read-all
│   ├── prisma/
│   │   ├── schema.prisma          # SQLite schema (local dev + tests); url = env("DATABASE_URL")
│   │   └── schema.postgres.prisma # PostgreSQL schema (production); identical models, provider = "postgresql"
│   ├── vitest.config.js          # Vitest 4 config: node env, globalSetup, setupFiles, singleFork, sequential
│   ├── Dockerfile                # Multi-stage: deps (npm ci + prisma generate) → runner (node)
│   ├── .dockerignore
│   ├── .env                      # Production env vars (DATABASE_URL=file:./hr_portal.db)
│   ├── .env.example              # Developer template — copy to .env and fill in
│   ├── .env.test                 # Test env override (DATABASE_URL=file:./prisma/test.db)
│   ├── POSTGRES.md               # PostgreSQL migration guide
│   └── src/__tests__/
│       ├── globalSetup.js        # Sets DATABASE_URL + JWT_SECRET before workers fork (env inherited by all workers)
│       ├── setup.js              # Per-file: wipes test DB, seeds 5 test users (upsert), exports getToken/getUser/testDb
│       ├── createTestDb.mjs      # Pretest script: runs prisma db push against test.db via cmd.exe
│       ├── auth.test.js          # 6 tests — login success/failure, /me auth, token validation
│       ├── applications.test.js  # 7 tests — list, pagination, RBAC, CRUD, manager scoping
│       └── rounds.test.js        # 7 tests — create, validation, ownership access, status update, session save, auto-reject
└── frontend/         # React + TypeScript SPA
    ├── Dockerfile        # Multi-stage: Vite build → nginx:alpine serve
    ├── nginx.conf        # SPA routing, /api + /socket.io proxy to backend:5000, gzip, asset caching
    ├── .dockerignore
    └── src/
        ├── App.tsx               # Route definitions; wrapped in ToastProvider
        ├── api/index.ts          # Axios client + all API functions
        ├── socket.ts             # Singleton Socket.io client (getSocket / disconnectSocket)
        ├── context/AuthContext.tsx  # Calls disconnectSocket() on logout
        ├── components/
        │   ├── Layout.tsx              # Sidebar nav + NotificationBell; ICON_MAP via lucide-react
        │   ├── NotificationBell.tsx    # Real-time bell via Socket.io; 5-min fallback poll; unread badge + dropdown
        │   ├── ui/                     # Shared UI primitives
        │   │   ├── StatusBadge.tsx   # Colored pill badge for status/difficulty
        │   │   ├── Skeleton.tsx      # Skeleton, SkeletonCard, SkeletonTable, SkeletonRow
        │   │   ├── EmptyState.tsx    # Empty state with icon + CTA
        │   │   └── Toast.tsx         # ToastProvider + useToast() hook
        │   └── interview/              # InterviewRoom sub-components (inline styles only)
        │       ├── VideoPanel.tsx      # myRole prop — shows "You (Interviewer/Candidate)" label
        │       ├── ChatPanel.tsx
        │       ├── NotesPanel.tsx
        │       ├── CodeEditorPanel.tsx
        │       ├── WhiteboardPanel.tsx # Toolbar: tools, colors, size, clear, undo
        │       └── ScorecardModal.tsx
        └── pages/
            ├── InterviewRoom.tsx      # Orchestrator; state + socket + WebRTC + session save/restore
            ├── InterviewLobby.tsx         # Pre-interview tech check
            ├── InterviewTimelinePage.tsx  # GitHub-style event feed + bookmarks
            ├── NotificationsPage.tsx      # Full notifications page; grouped by day, mark read
            ├── AnalyticsDashboard.tsx
            ├── QuestionBank.tsx
            ├── TemplatesPage.tsx
            ├── AuditLogPage.tsx
            ├── CodeReplayPage.tsx
            ├── admin/
            ├── hr/
            │   ├── Dashboard.tsx         # Dark theme, Lucide icons, SkeletonCard
            │   ├── Applications.tsx      # Dark theme, EmptyState, StatusBadge; server-side pagination
            │   ├── ApplicationDetail.tsx # Interview Journey timeline + Apply Template + Timeline links
            │   └── CommandCenter.tsx     # Live ops: today's interviews, pending reviews, pipeline, recent apps
            ├── interviewer/
            │   └── Dashboard.tsx         # Dark theme, Lucide icons, StatusBadge, lobby links
            ├── manager/
            │   └── ManagerDashboard.tsx  # Light theme; KPIs from /analytics/manager-summary; pipeline breakdown
            └── candidate/
                └── Dashboard.tsx         # Dark theme, Lucide icons, EmptyState, lobby links
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js, Express.js (ESM), Prisma ORM v5 |
| Database | SQLite (`backend/prisma/hr_portal.db`); test DB at `prisma/test.db` |
| Auth | JWT (8h expiry), bcryptjs |
| Real-time | Socket.io v4 + RTCPeerConnection (WebRTC) |
| Frontend | React 18, TypeScript, Vite 5 |
| Code editor | `@monaco-editor/react` (VS Code engine) |
| Styling | Tailwind CSS + inline styles (InterviewRoom sub-components use inline only) |
| Icons | `lucide-react` (consistent across all pages via Layout ICON_MAP) |
| HTTP client | Axios |
| Email | `nodemailer` + `ical-generator` (.ics calendar attachments) |
| Test import | XLSX library (Excel/Google Sheets) |
| Security | helmet, express-rate-limit |
| Code sandbox | Docker (`--network=none --memory=128m --cpus=0.5 --pids-limit=50 --cap-drop=ALL`) |
| Testing | Vitest 4 + Supertest — 20 API tests against real SQLite test DB |

## Database Models

- **User** — roles: ADMIN, MANAGER, HR, INTERVIEWER, CANDIDATE
- **JobPosition** — created by managers; status: OPEN/CLOSED
- **Application** — candidate ↔ position; status: PENDING → IN_PROGRESS → SELECTED/REJECTED; stores resumePath
- **Round** — types: TECHNICAL_INTERVIEW, HR_INTERVIEW, FINAL_INTERVIEW, TEST; fields: `notes`, `liveNotes`, `candidateFeedback`, `scorecard`, `sessionData` (all JSON strings)
- **Test** — assessments with ordered questions
- **Question** — MCQ (options + correct index) or TEXT (manual review)
- **TestAttempt** — UUID token, proctoring data, tab switch count, score
- **InterviewQuestion** — question bank; title, description, difficulty (EASY/MEDIUM/HARD), tags, hints, solution
- **InterviewTemplate** — pipeline templates; `stages` JSON array of `{type, order, description}`
- **AuditLog** — append-only; userId, userEmail, action, entityType, entityId, before, after, ip, createdAt
- **CodeSnapshot** — per-run code save; roundId, code, language, runOutput (JSON), savedBy, createdAt
- **InterviewEvent** — event timeline; roundId, eventType, actorRole, actorName, metadata (JSON), bookmarked, bookmarkNote, createdAt
- **Notification** — in-app alerts; userId, type, title, body, link, read (bool), createdAt

**schema.prisma datasource:** `url = env("DATABASE_URL")` — reads from env at runtime; production `.env` has `file:./hr_portal.db`, tests override to `file:./prisma/test.db`.

## Role Permissions

| Role | Access |
|------|--------|
| ADMIN | Full system access + user management + analytics + templates + audit log |
| HR | Positions, applications, tests, proctoring, analytics, question bank, templates, command center, notifications |
| MANAGER | Own positions, applications, analytics/manager-summary (scoped by managerId), notifications |
| INTERVIEWER | Assigned rounds, interview room, question bank, templates (read), code replay, event timeline, notifications |
| CANDIDATE | Own test attempts + interview room (assigned rounds only), notifications |

## Key API Routes

```
POST /api/auth/login
GET  /api/auth/me
GET  /api/users                               # ADMIN only

GET/POST   /api/positions                     # HR, MANAGER
GET/PUT    /api/positions/:id

GET/POST   /api/applications                  # HR, MANAGER — ?page&limit → { data, total, page, totalPages }; no params → flat array
GET/PUT    /api/applications/:id              # logAudit on status change

GET/POST   /api/rounds                        # HR, INTERVIEWER
GET        /api/rounds/:id                    # HR, ADMIN, INTERVIEWER (own), CANDIDATE (own)
PUT        /api/rounds/:id                    # logAudit on status change
PUT        /api/rounds/:id/live-notes         # INTERVIEWER — in-call notes (600ms debounce)
PUT        /api/rounds/:id/scorecard          # INTERVIEWER — structured scorecard JSON
PUT        /api/rounds/:id/candidate-feedback # CANDIDATE — post-interview rating
PUT        /api/rounds/:id/session            # INTERVIEWER/CANDIDATE — merge sessionData JSON (code, language, chatHistory, canvas, timerStart)
GET        /api/rounds/:id/interview-room     # INTERVIEWER + CANDIDATE — includes sessionData
POST       /api/rounds/:id/run-code           # INTERVIEWER + CANDIDATE — execute code (Docker)
GET        /api/rounds/:id/snapshots          # INTERVIEWER, HR, ADMIN — code replay history
POST       /api/rounds/:roundId/events        # Log interview event (INTERVIEWER, CANDIDATE, HR, ADMIN)
GET        /api/rounds/:roundId/events        # Fetch event timeline (INTERVIEWER own, HR, ADMIN)
PUT        /api/rounds/:roundId/events/:id/bookmark  # Toggle bookmark (INTERVIEWER, HR, ADMIN)

GET/POST   /api/tests                         # HR, INTERVIEWER — ?page&limit → { data, total, page, totalPages }; no params → flat array
GET/POST   /api/tests/attempt/:token          # CANDIDATE
GET        /api/tests/attempt/by-id/:id       # INTERVIEWER (own round only), HR, ADMIN

GET        /api/analytics/summary             # HR, ADMIN, MANAGER
GET        /api/analytics/funnel
GET        /api/analytics/rounds-by-type
GET        /api/analytics/recent-activity
GET        /api/analytics/interviewer-stats
GET        /api/analytics/manager-summary     # HR, ADMIN, MANAGER — scoped by managerId for MANAGER role
GET        /api/analytics/command-center      # HR, ADMIN — today's interviews, pending reviews, pipeline

GET        /api/notifications                 # current user — newest 50, includes unreadCount
PUT        /api/notifications/read-all        # mark all as read
PUT        /api/notifications/:id/read        # mark one as read

GET/POST/PUT/DELETE /api/questions            # HR, ADMIN, INTERVIEWER

GET/POST/PUT/DELETE /api/templates            # HR, ADMIN (GET: all roles)
POST       /api/templates/:id/apply           # HR, ADMIN — bulk-creates rounds on application

GET        /api/audit                         # ADMIN only — paginated, filterable

GET        /health                            # health check — { status: 'ok', timestamp }
```

## Frontend Routes

```
/login
/admin/audit                        # Audit log viewer (ADMIN)
/hr/dashboard
/hr/positions
/hr/applications                    # ApplicationDetail: Interview Journey + Apply Template + Timeline links
/hr/analytics
/hr/questions
/hr/templates
/hr/command-center                  # Live hiring ops (HR, ADMIN) — auto-refreshes every 60s
/interviewer/dashboard              # Dark theme, Lucide icons, lobby links, StatusBadge
/interviewer/questions
/interviewer/templates              # read-only view
/candidate/dashboard                # Dark theme, Lucide icons, EmptyState, lobby links
/notifications                      # All authenticated roles — full notification feed
/interview/:roundId/lobby           # Pre-interview tech check
/interview/:roundId/timeline        # Interview event timeline + bookmarks (must come before /:roundId)
/interview/:roundId/replay          # Code replay timeline (must come before /:roundId)
/interview/:roundId                 # Interview room
/test/:token                        # Candidate test attempt
```

**Route order in App.tsx matters:** `/timeline` and `/replay` must be registered before `/:roundId`.

## Interview Room (`/interview/:roundId`)

**Orchestrator pattern** — `InterviewRoom.tsx` holds all state, socket, and WebRTC logic. Six sub-components in `src/components/interview/` are purely presentational (props in, callbacks out). **All interview sub-components use 100% inline styles — zero Tailwind.**

| Sub-component | Responsibility |
|---------------|---------------|
| `VideoPanel` | Remote video, local PiP, peer name overlay, call duration, myRole label ("You (Interviewer/Candidate)") |
| `ChatPanel` | Scrollable message list, local input state, auto-scroll on new message |
| `NotesPanel` | Live notes textarea + autosave indicator |
| `CodeEditorPanel` | Monaco editor, language select, run button, output pane, problem statement |
| `WhiteboardPanel` | Canvas + toolbar (tools, colors, size, clear, undo) |
| `ScorecardModal` | Star ratings × 5, recommendation select, overall notes, submit/skip |

### Features

| Feature | Who | Details |
|---------|-----|---------|
| Bidirectional video/audio | Both | WebRTC RTCPeerConnection, join-order safe (ICE buffering) |
| Call duration timer | Both | Starts on peer connect; restored from localStorage on reload |
| Screen sharing | Both | `getDisplayMedia()`, replaces video track |
| In-call chat | Both | Socket.io relay, unread badge; persisted to localStorage |
| Live notes | Interviewer | 600ms debounce auto-save to `Round.liveNotes` |
| Resume viewer | Interviewer | Opens resumePath PDF in new tab |
| Collaborative code editor | Both | Monaco, real-time sync; auto-opens for TECHNICAL_INTERVIEW |
| Code execution | Both | Docker-sandboxed; saves CodeSnapshot; output to both peers |
| Whiteboard | Both | pen/rect/ellipse/arrow/eraser; **vector stroke sync** (not JPEG); undo button; late-join replay via full strokes sync |
| Structured scorecard | Interviewer | 5-category star ratings + recommendation + notes on end-call |
| Post-interview rating | Candidate | Respect / Clarity / Overall + comment → `candidateFeedback`; modal after interview-ended |
| Event logging | Both | Fire-and-forget: INTERVIEW_STARTED, CODE_RAN, SCREEN_SHARE_STARTED, WHITEBOARD_USED, SCORE_SUBMITTED, INTERVIEW_ENDED |
| Bookmark moments | Interviewer | Star button → optional note → BOOKMARK event → viewable in timeline |
| Post-interview redirect | Both | Interviewer → /interviewer after scorecard; Candidate → /candidate/dashboard after feedback |

### Session Recovery
Two-layer recovery: localStorage (same device, instant) + server-side `Round.sessionData` (cross-device).

**localStorage keys per roundId** (same-device, restored immediately on mount):
- `wb_code_${roundId}` — code editor content
- `wb_canvas_${roundId}` — whiteboard PNG snapshot
- `wb_chat_${roundId}` — chat messages JSON array
- `wb_timer_${roundId}` — call start timestamp (ms)

**Server-side `Round.sessionData`** (cross-device, restored when localStorage is empty):
- Saved via `PUT /api/rounds/:id/session` — auto-saved with debounce:
  - Code/language: 3s debounce on every keystroke
  - Chat history: on every message sent or received
  - Canvas: 5s debounce after every stroke (JPEG 0.5 quality)
  - Timer start: once when connection is first established
- On mount, if localStorage key is missing, values from `sessionData` are loaded and written to localStorage

### Scorecard JSON structure (saved to `Round.scorecard`)
```json
{
  "categories": [
    { "name": "Problem Solving", "score": 4 },
    { "name": "Coding Skills", "score": 3 },
    { "name": "Communication", "score": 5 },
    { "name": "System Design", "score": 3 },
    { "name": "Culture Fit", "score": 4 }
  ],
  "recommendation": "Hire",
  "overallNotes": "...",
  "submittedAt": "ISO string"
}
```
Recommendations: `Strong Hire` / `Hire` / `No Hire` / `Strong No Hire`

### Socket.io Events
```
join-interview-room          { roundId }
interview-peer-joined        {}
interview-offer/answer/ice   { roundId, offer/answer/candidate }
interview-leave              { roundId }
interview-peer-left          {}
interview-chat               { roundId, message, senderName, timestamp }
interview-code-sync          { roundId, code, language }
interview-code-problem       { roundId, problem }
interview-code-output        { stdout, stderr, exitCode, timestamp, sandboxed }
interview-end                { roundId }
interview-ended              {}
interview-whiteboard-stroke       { roundId, stroke }          ← vector: { tool, color, size, points[] }
interview-whiteboard-strokes-sync { roundId, strokes[] }        ← full history (undo + late-join)
interview-whiteboard-clear        { roundId }
```

### Code Execution (Docker)
- Images: `node:20-alpine`, `python:3.11-alpine` — must be pre-pulled
- Flags: `--rm -i --network=none --memory=128m --cpus=0.5 --pids-limit=50 --cap-drop=ALL --security-opt=no-new-privileges`
- Code delivered via stdin; no volume mount
- If Docker unavailable and `ALLOW_DIRECT_EXECUTION=true`: falls back to direct spawn (local dev only)
- If Docker unavailable and env var not set: returns **503 Service Unavailable** (safe default)
- Saves `CodeSnapshot` fire-and-forget after each run
- Response includes `sandboxed: boolean`

## Interview Event Timeline (`/interview/:roundId/timeline`)

GitHub-style activity feed for every interview session. Available to INTERVIEWER (own rounds), HR, ADMIN.

### Logged Event Types
| eventType | Trigger | Actor |
|-----------|---------|-------|
| INTERVIEW_STARTED | Peer connects | interviewer/candidate |
| CODE_RAN | Code execution button pressed | interviewer/candidate |
| SCREEN_SHARE_STARTED | Screen share initiated | interviewer/candidate |
| WHITEBOARD_USED | First whiteboard stroke (per session) | interviewer/candidate |
| SCORE_SUBMITTED | Scorecard submitted | interviewer |
| INTERVIEW_ENDED | interview-ended socket event | interviewer/candidate |
| BOOKMARK | Interviewer clicks star button | interviewer |

### Bookmark Feature
- Interviewer-only star button in interview room toolbar (inline styles)
- Optional note attached to the bookmark
- All bookmarks visible in the timeline page with yellow left border
- "Only bookmarks" filter on timeline page
- Timestamps shown relative to first event (HH:MM:SS)

### InterviewEvent JSON (stored in `InterviewEvent.metadata`)
Varies by type — CODE_RAN includes `{ language }`, SCORE_SUBMITTED includes `{ recommendation }`, BOOKMARK includes `{ note }`.

## Shared UI Components (`src/components/ui/`)

| Component | Usage |
|-----------|-------|
| `StatusBadge` | `<StatusBadge status="PENDING" />` — colored pill for any status or difficulty |
| `Skeleton` / `SkeletonCard` / `SkeletonTable` | Animated loading placeholders; replaces spinners |
| `EmptyState` | `<EmptyState icon={Icon} title="..." description="..." action={...} />` |
| `Toast` / `useToast()` | `const { success, error, info } = useToast()` — bottom-right auto-dismiss toasts |

`ToastProvider` wraps the entire app in `App.tsx`. All pages use `useToast()` for feedback.

### StatusBadge covers these values:
PENDING, IN_PROGRESS, SELECTED, REJECTED, PASSED, FAILED, OPEN, CLOSED, SUBMITTED, TERMINATED, EASY, MEDIUM, HARD

### Layout nav icons (lucide-react via ICON_MAP):
LayoutDashboard, Briefcase, Users, ClipboardList, FileText, Shield, BarChart3, BookOpen, Layers, ScrollText, Eye, LogOut, MonitorPlay

## Interview Journey Timeline (`ApplicationDetail.tsx`)

Visual vertical timeline on the HR application detail page showing candidate progression:
1. **Application Received** — date, yellow dot, green "Applied" pill
2. **Each round** (sorted by `round.order`) — type icon, status badge, interviewer name, scheduled date, scorecard recommendation pill if available, "Timeline →" link to `/interview/:roundId/timeline`
3. **Current Status** — application status with color-coded dot

Round type icons: TEST→ClipboardList, TECHNICAL_INTERVIEW→Code2, HR_INTERVIEW→MessageSquare, FINAL_INTERVIEW→Star
Dot colors: PASSED/SELECTED=green, FAILED/REJECTED=red, IN_PROGRESS=blue, PENDING=gray
No new API calls — uses existing `app` state (which includes `app.rounds`).

## Interview Templates (`/hr/templates`)

One-click pipeline creation:
- Stage types: TEST, TECHNICAL_INTERVIEW, HR_INTERVIEW, FINAL_INTERVIEW
- `POST /api/templates/:id/apply { applicationId }` — bulk-creates rounds, advances to IN_PROGRESS
- Apply Template button on ApplicationDetail page
- logAudit() called on create (`TEMPLATE_CREATED`) and apply (`TEMPLATE_APPLIED`)

## Audit Log (`/admin/audit`)

Append-only, ADMIN only. `logAudit()` in `middleware/audit.js` — fire-and-forget, never crashes route.

**Currently wired actions:**
- `TEMPLATE_CREATED` — templates.js POST /
- `TEMPLATE_APPLIED` — templates.js POST /:id/apply
- `APPLICATION_STATUS_CHANGED` — applications.js PUT /:id (when status field changes)
- `ROUND_STATUS_CHANGED` — rounds.js PUT /:id (when status field changes)

## Notification + Email System

Every `notifyUser()` call creates an in-app notification (DB + Socket.io push) AND optionally sends an email when `emailContext` is provided by the caller.

### Notification Types
| type | Trigger | Recipient | Email sent |
|------|---------|-----------|-----------|
| `APPLICATION_RECEIVED` | New application created | All HR + ADMIN users | No (high volume) |
| `ROUND_ASSIGNED` | Round created with interviewerId | The assigned interviewer | Yes — only when no scheduled invite already sent |
| `ROUND_PASSED` | Round status → PASSED | The candidate | Yes — "Congratulations" email |
| `ROUND_FAILED` | Round status → FAILED | The candidate | Yes — "thank you / not moving forward" email |
| `ROUND_COMPLETED` | Round marked PASSED or FAILED | All HR + ADMIN users | Yes — "ready for review" email with link |

### Calendar invites (.ics)
`sendInterviewInvite()` in `email.js` attaches a `.ics` file (generated by `ical-generator`) to both the candidate and interviewer emails when `scheduledAt` is set. The event includes title, start time, location (interview link), and description.

### Key files
- `backend/src/middleware/notify.js` — `notifyUser({ userId, type, title, body, link, emailContext? })` and `notifyUsers(ids[], payload)`; email is fire-and-forget via `sendNotificationEmail()`
- `backend/src/email.js` — `send()`, `generateICS()`, `sendInterviewInvite()` (with .ics), `sendNotificationEmail()` (routes to per-type templates), plus `sendTestInvite`, `sendTestSubmittedAlert`, `sendProctorInvite`, `sendApplicationStatusUpdate`
- `backend/src/routes/notifications.js` — `GET /api/notifications` (newest 50 + unreadCount), `PUT /api/notifications/:id/read`, `PUT /api/notifications/read-all`
- `frontend/src/components/NotificationBell.tsx` — real-time via Socket.io `notification` event; 5-min fallback poll; dropdown with mark-all-read; navigates to `/notifications`
- `frontend/src/socket.ts` — singleton socket (`getSocket()` / `disconnectSocket()`); connects with JWT token; joined to `user-${userId}` room on server for personal push events
- `frontend/src/pages/NotificationsPage.tsx` — full feed grouped by day; click to mark read; links to `notification.link`

### Notification model
```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(...)
  type      String
  title     String
  body      String
  link      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

## Command Center (`/hr/command-center`)

Live ops dashboard for HR and ADMIN. Auto-refreshes every 60s. Available via "Command Center" nav link (first item for HR and ADMIN).

### Four panels
| Panel | Data source | Details |
|-------|-------------|---------|
| **Pipeline KPIs** | `GET /analytics/command-center` | 4 cards: Pending / In Progress / Selected / Rejected with percentage bars |
| **Today's Interviews** | same | Rounds scheduled today (any interview type), sorted by time; links to interview room |
| **Pending Reviews** | same | Completed rounds (`PASSED`/`FAILED`) with no scorecard yet; links to ApplicationDetail |
| **Recent Applications** | same | Last 5 applications; links to ApplicationDetail |
| **Pipeline Health** | same | Horizontal progress bars per status + hire rate / rejection rate |

Backend endpoint: `GET /api/analytics/command-center` — accessible by HR and ADMIN (blocked at router level for MANAGER).

## Pagination

Applications and tests lists support server-side pagination. The response shape changes based on whether `?page` is present — existing callers (HRDashboard for counts, ManagerDashboard for filtering, ApplicationDetail for dropdowns) continue to receive flat arrays.

| Page | API function | Paginated |
|------|-------------|-----------|
| `hr/Applications.tsx` | `getApplicationsPaginated(page, limit, positionId?)` | ✅ — Previous / Page X of Y / Next bar |
| `hr/Tests.tsx` | `getTestsPaginated(page, limit)` | ✅ — same bar |
| `hr/HRDashboard.tsx` | `getApplications()` / `getTests()` | ✗ — counts only |
| `manager/ManagerDashboard.tsx` | `getApplications()` | ✗ — filtered client-side |
| `hr/ApplicationDetail.tsx` | `getTests()` | ✗ — dropdown only |
| `interviewer/InterviewerTests.tsx` | `getTests()` | ✗ — full list (small) |

## Code Replay (`/interview/:roundId/replay`)

- Fetches `CodeSnapshot` records in chronological order
- Two-panel: timeline list + code/output viewer (`<pre>` display)
- "View Timeline" link → `/interview/:roundId/timeline`
- Available to INTERVIEWER (own rounds), HR, ADMIN

## Testing

**20 API tests — 20/20 passing.** Real SQLite test DB, no mocks.

### Setup
```bash
cd backend
npm test          # runs pretest (db push to test.db) then vitest
npm run test:db   # push schema to test.db only (via src/__tests__/createTestDb.mjs)
npm run test:watch
```

### Architecture
- `vitest.config.js` — `pool: 'forks'`, `forks: { singleFork: true }`, `sequence: { concurrent: false }`, `globalSetup`, `setupFiles`
- `src/__tests__/globalSetup.js` — runs in main Vitest process before any worker forks; sets `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `ALLOW_DIRECT_EXECUTION`; env vars inherited by all workers so `new PrismaClient()` in `app.js` connects to test DB even before `import 'dotenv/config'` runs
- `src/__tests__/setup.js` — runs before each test file; wipes all test data (dependency order), seeds 5 users via `upsert`; exports `getToken(role)`, `getUser(role)`, `testDb`
- `src/__tests__/createTestDb.mjs` — pretest script; cross-platform: `cmd.exe + prisma.cmd` on Windows, direct `node + prisma/build/index.js` on Linux/macOS (CI)
- `backend/.env.test` — `DATABASE_URL=file:./prisma/test.db`

### Why `app.js` was extracted from `index.js`
Supertest needs the Express `app` object without calling `listen()`. All server logic (middleware, routes, Socket.io, Prisma client) now lives in `src/app.js`; `src/index.js` is just the entry point that imports and starts. Both export `prisma` and `io` for use by routes.

**`app.js` Prisma client:** `new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL || 'file:./hr_portal.db' } } })` — explicit URL override ensures the env var is respected even when the old generated client binary has an outdated config.

### Test suites
| File | Tests | What's covered |
|------|-------|----------------|
| `auth.test.js` | 6 | Login success/failure, wrong password, unknown email, /me with valid token, /me without token, /me with malformed token |
| `applications.test.js` | 7 | List (HR), paginated list, CANDIDATE 403, create, get by id, status update, manager scoping |
| `rounds.test.js` | 7 | Create, missing-interviewer validation, interviewer gets own round, candidate 403, status update to PASSED, session save, auto-REJECTED application on FAILED round |

### Running tests note
Tests must be run with the backend server **stopped** if the test DB path differs from the production DB — the Prisma DLL cannot be regenerated while the server holds it open. The test DB (`prisma/test.db`) is in `.gitignore` and is always freshly created by `npm run test:db` before each run.

## CI/CD

**GitHub Actions** — `.github/workflows/ci.yml`. Triggers on push/PR to `main`. Two parallel jobs:

| Job | Steps | Notes |
|-----|-------|-------|
| `backend` | `npm ci` → push test schema → `vitest run` | Bypasses `createTestDb.mjs` (Windows-only); pushes SQLite schema directly via `node prisma/build/index.js db push`. Env: `DATABASE_URL=file:./prisma/test.db`, `JWT_SECRET`, `ALLOW_DIRECT_EXECUTION=true`, `NODE_ENV=test` |
| `frontend` | `npm ci` → `npm run build` | Runs `tsc && vite build` — covers type check + bundle in one step |

No secrets required in GitHub — tests use SQLite and a hardcoded CI JWT secret.

## Deployment

### Docker Compose (self-hosted / local production preview)
```bash
cp backend/.env.example .env   # set JWT_SECRET at minimum
docker-compose up --build
```
Services: `postgres` (16-alpine with healthcheck) + `backend` (port 5000, waits for postgres healthy) + `frontend` (nginx port 80, proxies `/api` and `/socket.io` to backend).

`ALLOW_DIRECT_EXECUTION` is **not set** in docker-compose — Docker sandbox is enforced.

### Render (cloud)
`render.yaml` at project root. Connect GitHub repo in the Render dashboard. Set the `sync: false` env vars manually:
- `JWT_SECRET`, `DATABASE_URL` (use Render's free PostgreSQL add-on), `FRONTEND_URL`, SMTP vars

### Key files
| File | Purpose |
|------|---------|
| `backend/Dockerfile` | Two-stage: prod deps + prisma generate → copy + run |
| `frontend/Dockerfile` | Vite build → nginx:alpine |
| `frontend/nginx.conf` | SPA routing, API/socket proxy, asset caching |
| `docker-compose.yml` | Full stack with PostgreSQL |
| `render.yaml` | Render web service config |
| `backend/.env.example` | Developer env template |

## PostgreSQL (Production)

Local dev and tests always use SQLite (`hr_portal.db` / `prisma/test.db`). PostgreSQL is for production deployment.

### Schema files
- `prisma/schema.prisma` — SQLite, used by `npm run db:push` and all tests
- `prisma/schema.postgres.prisma` — PostgreSQL, identical models, `provider = "postgresql"`

### Scripts (in `backend/package.json`)
| Script | What it does |
|--------|-------------|
| `db:push:postgres` | Push schema without migrations (prototyping) |
| `migrate:dev` | Create initial migration interactively (`prisma migrate dev`) |
| `migrate:prod` | Deploy pending migrations non-interactively (CI/CD safe) |
| `generate:postgres` | Regenerate Prisma client from PostgreSQL schema |

### Switching to PostgreSQL
1. Set `DATABASE_URL=postgresql://user:pass@host:5432/dbname`
2. Run `npm run migrate:dev` once to create `prisma/migrations/`
3. In production/CI: `npm run migrate:prod`
4. No route code changes needed — JSON fields remain `String` type in both schemas

See `backend/POSTGRES.md` for the full step-by-step guide.

## Development Setup

```bash
# Backend (SQLite, local dev)
cd backend && npm install
npm run db:push    # push schema to hr_portal.db (SQLite)
npm run db:seed
npm run dev        # port 5000

# Tests (stop dev server first)
npm test           # creates prisma/test.db + runs 20 Vitest tests

# Frontend
cd frontend && npm install
npm run dev        # port 5173

# Docker sandbox (one-time — required for sandboxed code execution)
docker pull node:20-alpine
docker pull python:3.11-alpine

# Full stack via Docker Compose (uses PostgreSQL)
cp backend/.env.example .env   # set JWT_SECRET
docker-compose up --build

# PostgreSQL (production)
# Set DATABASE_URL=postgresql://... then:
cd backend
npm run migrate:dev    # create initial migration (first time)
npm run migrate:prod   # deploy migrations (CI/CD)
```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@company.com | admin123 |
| Manager | manager@company.com | manager123 |
| HR | hr@company.com | hr123 |
| Interviewer | interviewer@company.com | interviewer123 |

## Environment Variables

**backend/.env** (production)
```
PORT=5000
JWT_SECRET=<strong-random-secret>
FRONTEND_URL=http://localhost:5173
DATABASE_URL=file:./hr_portal.db
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<gmail>
SMTP_PASS=<app-password>
SMTP_FROM=HR Portal <email>
# Set to "true" ONLY in local dev when Docker is not installed. Never set in production.
ALLOW_DIRECT_EXECUTION=true
```

**backend/.env.test** (test runner)
```
DATABASE_URL=file:./prisma/test.db
```

**frontend/.env**
```
VITE_API_URL=/api
VITE_SOCKET_URL=
```

## Proctoring System

- Webcam required before test starts; fullscreen enforced
- copy/paste, right-click, devtools blocked
- Tab switches counted; >3 auto-terminates
- WebRTC stream to assigned proctor via Socket.io
- Monitored live in `ProctoringView.tsx`

## Test Import Format

```
question | option_a | option_b | option_c | option_d | correct_answer | type
```
- `correct_answer`: A/B/C/D for MCQ, empty for TEXT
- Google Sheets: publish as CSV and paste URL

## Scoring

- MCQ: auto-scored (correct / total × 100); pass threshold 60%
- TEXT: manual review; visible to HR, Interviewers, Admins

## Styling Conventions

- **InterviewRoom.tsx and all `components/interview/` sub-components**: 100% inline styles — zero Tailwind
- **InterviewTimelinePage.tsx and all other pages**: Tailwind utility classes, dark theme
- Dark theme: `bg-gray-900` pages, `bg-gray-800` cards, `border-gray-700` borders, `text-yellow-400` accents, `text-white` headings
- Icons: lucide-react throughout (except InterviewRoom which uses inline SVG)
- CSS variables: `--obsidian`, `--gold`, `--text-primary`
- No external component library

## Security

- `helmet` (COEP disabled for WebRTC), `express-rate-limit` (15 logins/15min, 200 req/min)
- JWT on all routes and Socket.io handshake
- Docker sandbox: no network, memory/CPU/PID limits, all capabilities dropped
- Docker unavailable + no `ALLOW_DIRECT_EXECUTION=true` → **503** (not silent fallback)
- INTERVIEWER can only access test attempts for their own assigned rounds
- All email sends are fire-and-forget — SMTP errors never crash a route

## Known Limitations / Future Work

- Docker images must be pre-pulled before first code run (`docker pull node:20-alpine python:3.11-alpine`)
- No refresh token (8h hard JWT expiry) — production should add short-lived access + 30-day refresh tokens
- No interview recording (future: MediaRecorder + S3 + consent UI)
- No background job queue — email is fire-and-forget; production should add BullMQ + Redis for retry/dead-letter
- Cloudflare tunnel URL changes on restart — update `FRONTEND_URL` in `.env`
- HMR does not work through Cloudflare tunnel — hard-refresh required (Ctrl+Shift+R)
- InterviewLobby not linked from HR/Manager dashboards (linked from candidate + interviewer dashboards)
- Pagination not implemented on rounds list endpoint
- Whiteboard vector strokes in-memory only (`strokesRef` lost on reload); canvas PNG persists but undo history does not
- Email notifications fire for ROUND_PASSED/FAILED/COMPLETED/ASSIGNED — APPLICATION_RECEIVED is in-app only (would spam HR on high volume)
- `prisma generate` cannot run while the dev server is running on Windows (DLL locked); stop the server before schema changes
- Test suite covers auth, applications, rounds — no Socket.io or WebRTC integration tests (high complexity, low ROI)
- Resume uploads use local disk (`uploads/resumes/`) — production should use S3/Cloudinary via the uploads volume in docker-compose
