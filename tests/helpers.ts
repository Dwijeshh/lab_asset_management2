import { randomBytes } from 'crypto';
import fs from 'node:fs';
import path from 'node:path';

export const APP_URL =
  process.env.TEST_APP_URL || `http://localhost:${process.env.TEST_APP_PORT || '3112'}`;

// Guarantees a unique X-Forwarded-For per client within this process.
let clientCounter = 0;
// Vitest isolates files in separate workers, so a module-local counter starts
// at the same value in every API suite. Give each worker a distinct private
// IPv4 prefix to keep the shared app server's login rate-limit buckets apart.
const clientScope = randomBytes(2);

export interface ApiResponse {
  status: number;
  body: any;
}

export interface ApiClient {
  /** Session cookie captured from Set-Cookie (empty until a login). */
  cookie: string;
  get: (path: string) => Promise<ApiResponse>;
  post: (path: string, body?: unknown) => Promise<ApiResponse>;
  put: (path: string, body?: unknown) => Promise<ApiResponse>;
  del: (path: string, body?: unknown) => Promise<ApiResponse>;
}

/**
 * Fetch wrapper that keeps the session cookie and sends a unique
 * X-Forwarded-For per client. The test server trusts proxy headers
 * (TRUST_PROXY=true), so each client gets its own rate-limit bucket and the
 * throttle tests cannot pollute each other.
 */
export function makeClient(initialCookie = ''): ApiClient {
  let cookie = initialCookie;
  const forwardedFor = `10.${clientScope[0]}.${clientScope[1]}.${(clientCounter++ % 250) + 2}`;

  const request = async (method: string, path: string, body?: unknown): Promise<ApiResponse> => {
    const headers: Record<string, string> = {
      'X-Forwarded-For': forwardedFor,
    };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${APP_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      redirect: 'manual',
    });

    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/);
      if (match) cookie = `session=${match[1]}`;
    }

    let parsed: any = null;
    const text = await res.text();
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed };
  };

  return {
    get cookie() {
      return cookie;
    },
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    del: (path, body) => request('DELETE', path, body),
  };
}

/** Logs in and returns a client carrying the session cookie. */
export async function login(email: string, password = 'password123'): Promise<ApiClient> {
  const cacheFile = path.join(
    process.cwd(),
    '.freebuff',
    `test-sessions-${process.env.TEST_APP_PORT || '3112'}.json`,
  );
  if (fs.existsSync(cacheFile)) {
    const sessions = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as Record<string, string>;
    const seededSession = sessions[email.toLowerCase()];
    if (seededSession) return makeClient(seededSession);
  }
  const client = makeClient();
  const res = await client.post('/api/auth/login', { email, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return client;
}

/** Unique email per run so repeated test executions do not collide. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString('hex')}@manipal.edu`;
}

/**
 * Creates a fresh asset in the given lab via the client (must be in the same
 * college). Each test creates its own asset so the suite never depends on or
 * exhausts the seed data.
 */
let cachedAdmin: ApiClient | null = null;

export async function getHelperAdminClient(): Promise<ApiClient> {
  if (!cachedAdmin) {
    cachedAdmin = await login('admin@manipal.edu');
  }
  return cachedAdmin;
}

export async function createAsset(client: ApiClient, labId: number): Promise<any> {
  let res = await client.post('/api/assets', {
    name: `Test Asset ${Date.now()}-${randomBytes(3).toString('hex')}`,
    location: 'Test bench',
    category: 'laptop',
    labId,
  });
  if (res.status === 403) {
    const admin = await getHelperAdminClient();
    res = await admin.post('/api/assets', {
      name: `Test Asset ${Date.now()}-${randomBytes(3).toString('hex')}`,
      location: 'Test bench',
      category: 'laptop',
      labId,
    });
  }
  if (res.status !== 201) {
    throw new Error(`create asset failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

/**
 * Deletes an asset created by a test, including rows that reference it
 * (loans, requests, notifications, audit logs). Keeps the suite
 * non-destructive when run against a shared database.
 */
export async function cleanupAsset(assetId: number): Promise<void> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `DELETE FROM notifications WHERE related_loan_id IN (SELECT id FROM asset_loans WHERE asset_id = $1)
        OR related_request_id IN (SELECT id FROM asset_requests WHERE asset_id = $1)`,
      [assetId]
    );
    await client.query('DELETE FROM asset_loans WHERE asset_id = $1', [assetId]);
    await client.query('DELETE FROM asset_requests WHERE asset_id = $1', [assetId]);
    await client.query("DELETE FROM audit_logs WHERE entity_id = $1 AND entity_type = 'asset'", [assetId]);
    await client.query('DELETE FROM assets WHERE id = $1', [assetId]);
  } finally {
    await client.end();
  }
}

/**
 * Rejects every pending request visible to the given (main technician)
 * client. Keeps the borrowing suites idempotent: a previous run's leftover
 * pending requests would otherwise collide with the duplicate-request check.
 */
export async function rejectAllPending(mainTech: ApiClient): Promise<void> {
  const res = await mainTech.get('/api/asset-requests');
  if (res.status !== 200) return;
  for (const row of res.body.data) {
    if (row.request && row.request.status === 'pending') {
      await mainTech.put(`/api/asset-requests/${row.request.id}`, { action: 'reject' });
    }
  }
}

/**
 * Best-effort cleanup of a user row created by a test, including rows that
 * reference it (audit logs, notifications). Ignores FK failures.
 */
export async function deleteUser(userId: number): Promise<void> {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const table of ['audit_logs', 'notifications']) {
      try {
        await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
      } catch {
        // column may not exist on some tables — ignore
      }
    }
    try {
      await client.query('DELETE FROM audit_logs WHERE entity_id = $1 AND entity_type = $2', [userId, 'user']);
    } catch {
      // ignore
    }
    await client.query('DELETE FROM users WHERE id = $1', [userId]);
  } finally {
    await client.end();
  }
}
