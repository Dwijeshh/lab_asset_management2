import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Load .env for local runs (CI provides env explicitly).
import 'dotenv/config';

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.TEST_APP_PORT || '3112';
export const APP_URL = `http://localhost:${PORT}`;
const LOG_FILE = path.join(ROOT, '.freebuff', `test-server-${PORT}.log`);

// The app server runs with NODE_ENV=production, where auth-jwt fails fast on
// a weak JWT_SECRET — provide a strong one for tests.
const TEST_JWT_SECRET =
  process.env.TEST_JWT_SECRET ||
  process.env.JWT_SECRET ||
  'test-only-secret-0123456789abcdefghijklmnop';

async function isUp(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${APP_URL}/api/health`);
      if (res.ok) return;
      lastError = `health: ${res.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Test server did not become healthy. Last: ${lastError}`);
}

function runNext(args: string[], stdio: Array<'ignore' | 'pipe' | number>): ReturnType<typeof spawn> {
  // Invoke the Next CLI through node directly so this works on Windows
  // without shell resolution of npx.cmd.
  return spawn('node', [path.join('node_modules', 'next', 'dist', 'bin', 'next'), ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
      JWT_SECRET: TEST_JWT_SECRET,
      TRUST_PROXY: 'true', // let tests use a unique X-Forwarded-For per client
      PORT,
    },
    stdio,
  });
}

export default async function setup(): Promise<void> {
  // Never silently reuse a stale server from a previous run — its in-memory
  // rate-limit buckets would bleed into this run's tests.
  if (await isUp(`${APP_URL}/api/health`)) {
    throw new Error(
      `Port ${PORT} already serves a healthy app. Free it or set TEST_APP_PORT / TEST_APP_URL.`
    );
  }

  // Build once if there is no build output yet.
  if (!fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    const buildOutput: string[] = [];
    const build = runNext(['build'], ['ignore', 'pipe', 'pipe']);
    build.stdout?.on('data', (chunk) => buildOutput.push(String(chunk)));
    build.stderr?.on('data', (chunk) => buildOutput.push(String(chunk)));
    const code = await new Promise<number>((resolve) => build.on('exit', (c) => resolve(c ?? 1)));
    if (code !== 0) {
      throw new Error(`next build failed:\n${buildOutput.join('').slice(-4000)}`);
    }
  }

  // Log to a file (not pipes) so vitest never waits on open handles.
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const logFd = fs.openSync(LOG_FILE, 'a');
  const child = runNext(['start', '-p', PORT], ['ignore', logFd, logFd]);
  (globalThis as Record<string, unknown>).__TEST_SERVER__ = child;

  try {
    await waitForHealth(60_000);
  } catch (error) {
    killTree(child);
    throw error;
  }
}

function killTree(child: ReturnType<typeof spawn>): void {
  if (process.platform === 'win32') {
    // Kill the whole process tree — `next start` spawns workers, and a
    // surviving stale server would poison the next run's rate-limit buckets.
    spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
  } else {
    child.kill();
  }
}

export async function teardown(): Promise<void> {
  const child = (globalThis as Record<string, unknown>).__TEST_SERVER__;
  if (child && typeof (child as { kill: () => void }).kill === 'function') {
    killTree(child as ReturnType<typeof spawn>);
  }
}