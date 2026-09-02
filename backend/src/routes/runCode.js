import { Router } from 'express';
import { execSync, spawn } from 'child_process';
import { prisma, io } from '../index.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const MAX_OUTPUT = 10_000;
const TIMEOUT_MS = 10_000;

// Check Docker availability once at module load
let dockerAvailable = false;
const allowDirectExecution = process.env.ALLOW_DIRECT_EXECUTION === 'true';
try {
  execSync('docker info', { stdio: 'ignore', timeout: 5000 });
  dockerAvailable = true;
  console.log('[runCode] Docker available — using sandboxed execution');
} catch {
  if (allowDirectExecution) {
    console.warn('[runCode] Docker not available — ALLOW_DIRECT_EXECUTION=true, using direct execution (development only)');
  } else {
    console.error('[runCode] Docker not available and ALLOW_DIRECT_EXECUTION is not set — code execution disabled');
  }
}

function runInDocker(language, code) {
  return new Promise((resolve) => {
    const image = language === 'python' ? 'python:3.11-alpine' : 'node:20-alpine';
    const cmd = language === 'python' ? 'python' : 'node';

    const child = spawn('docker', [
      'run', '--rm', '-i',
      '--network=none',
      '--memory=128m',
      '--cpus=0.5',
      '--pids-limit=50',
      '--cap-drop=ALL',
      '--security-opt=no-new-privileges',
      image,
      cmd
    ]);

    let stdout = '';
    let stderr = '';
    let finished = false;

    const killTimer = setTimeout(() => {
      if (!finished) {
        child.kill('SIGKILL');
        stderr += '\n[Execution timed out after 10 seconds]';
      }
    }, TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > MAX_OUTPUT) stdout = stdout.slice(0, MAX_OUTPUT) + '\n[output truncated]';
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(0, MAX_OUTPUT) + '\n[output truncated]';
    });

    child.on('close', exitCode => {
      finished = true;
      clearTimeout(killTimer);
      resolve({ stdout, stderr, exitCode });
    });

    child.on('error', err => {
      finished = true;
      clearTimeout(killTimer);
      resolve({ stdout: '', stderr: err.message, exitCode: -1 });
    });

    child.stdin.write(code);
    child.stdin.end();
  });
}

function runDirect(language, code) {
  return new Promise((resolve) => {
    const cmd = language === 'python'
      ? (process.platform === 'win32' ? 'python' : 'python3')
      : 'node';
    const args = language === 'python' ? ['-c', code] : ['-e', code];

    let stdout = '';
    let stderr = '';
    let finished = false;

    const child = spawn(cmd, args, { timeout: TIMEOUT_MS });

    const killTimer = setTimeout(() => {
      if (!finished) child.kill('SIGKILL');
    }, TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
      if (stdout.length > MAX_OUTPUT) stdout = stdout.slice(0, MAX_OUTPUT) + '\n[output truncated]';
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
      if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(0, MAX_OUTPUT) + '\n[output truncated]';
    });

    child.on('close', exitCode => {
      finished = true;
      clearTimeout(killTimer);
      resolve({ stdout, stderr, exitCode });
    });

    child.on('error', err => {
      finished = true;
      clearTimeout(killTimer);
      resolve({ stdout: '', stderr: err.message, exitCode: -1 });
    });
  });
}

router.post('/:id/run-code', authorize('INTERVIEWER', 'CANDIDATE', 'HR', 'ADMIN'), async (req, res) => {
  try {
    const { code, language } = req.body;
    if (!code || typeof code !== 'string') return res.status(400).json({ error: 'code is required' });
    if (!['javascript', 'python'].includes(language)) return res.status(400).json({ error: 'Unsupported language' });

    const round = await prisma.round.findUnique({
      where: { id: req.params.id },
      include: { application: { select: { candidateEmail: true } } }
    });
    if (!round) return res.status(404).json({ error: 'Round not found' });

    const isInterviewer = round.interviewerId === req.user.id;
    const isCandidate = req.user.role === 'CANDIDATE' &&
      round.application?.candidateEmail?.toLowerCase() === req.user.email?.toLowerCase();
    if (!isInterviewer && !isCandidate && !['HR', 'ADMIN'].includes(req.user.role))
      return res.status(403).json({ error: 'Access denied' });

    if (!dockerAvailable && !allowDirectExecution) {
      return res.status(503).json({
        error: 'Code execution sandbox is unavailable. Docker is required in production.',
        sandboxed: false
      });
    }

    const { stdout, stderr, exitCode } = dockerAvailable
      ? await runInDocker(language, code)
      : await runDirect(language, code);

    // Save code snapshot
    const savedBy = isCandidate ? 'candidate' : 'interviewer';
    prisma.codeSnapshot.create({
      data: {
        roundId: req.params.id,
        code,
        language,
        runOutput: JSON.stringify({ stdout, stderr, exitCode }),
        savedBy
      }
    }).catch(() => {}); // fire-and-forget, don't block response

    const result = {
      stdout,
      stderr,
      exitCode,
      timestamp: Date.now(),
      sandboxed: dockerAvailable
    };
    io.to(`interview-${req.params.id}`).emit('interview-code-output', result);
    res.json(result);
  } catch (e) {
    console.error('run-code error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
