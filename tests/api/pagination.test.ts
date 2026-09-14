import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, makeClient, createAsset, cleanupAsset, uniqueEmail, type ApiClient } from '../helpers';

// Dedicated per-run users: shared seed accounts have per-account login
// throttles (5 per 15 min) that other test files also consume, so we create
// our own to keep runs independent.
let tech1: ApiClient;
let mainTech: ApiClient;
let tech1LabId: number;
let otherLabId: number;
let mainTechId: number;

// Data created by this suite; cleaned up in afterAll.
const createdAssets: number[] = [];
const createdRequests: number[] = [];
let createdUserIds: number[] = [];

const futureDate = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

/**
 * Creates an active user row directly (bypassing the login-throttled API).
 * Password is always 'password123', hashed with the app's own bcrypt path.
 */
async function seedUser(role: 'technician' | 'main_technician', collegeId: number, labId: number | null): Promise<number> {
  const { hashPassword } = await import('@/lib/auth-jwt');
  const passwordHash = await hashPassword('password123');
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    const email = uniqueEmail(`pagetest-${role}`);
    const res = await client.query(
      `INSERT INTO users (email, password_hash, name, role, college_id, lab_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
      [email, passwordHash, role === 'main_technician' ? 'Page Main Tech' : 'Page Tech', role, collegeId, labId]
    );
    return res.rows[0].id;
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  // Discover the seed tech's college/lab + a second lab in the same college
  // via an admin client, then create dedicated users in that college.
  const admin = await login('admin@manipal.edu');
  const me = await admin.get('/api/auth/me');
  const colleges = await admin.get('/api/colleges');
  const collegeId = me.body.user.collegeId;

  const labsRes = await admin.get(`/api/labs`);
  const collegeLabs = labsRes.body.data.filter((lab: any) => lab.collegeId === collegeId);
  if (collegeLabs.length < 2) throw new Error('seed has fewer than two labs in the admin college');
  tech1LabId = collegeLabs[0].id;
  otherLabId = collegeLabs[1].id;

  const techId = await seedUser('technician', collegeId, tech1LabId);
  mainTechId = await seedUser('main_technician', collegeId, tech1LabId);
  createdUserIds = [techId, mainTechId];

  // Log the new users in through the normal flow.
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    const emails = await client.query('SELECT email FROM users WHERE id = ANY($1)', [
      createdUserIds,
    ]);
    var techEmail: string = emails.rows[0].email;
    var mainEmail: string = emails.rows[1].email;
  } finally {
    await client.end();
  }

  tech1 = await login(techEmail);
  mainTech = await login(mainEmail);
  void colleges; // fetched for typing clarity above
});

afterAll(async () => {
  // Assets (and their requests/notifications/audit rows, handled inside
  // cleanupAsset) must go first: assets.created_by_id references users.
  while (createdAssets.length) {
    await cleanupAsset(createdAssets.pop() as number);
  }

  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    for (const id of createdUserIds) {
      await client.query('DELETE FROM notifications WHERE user_id = $1', [id]);
      await client.query('DELETE FROM audit_logs WHERE user_id = $1', [id]);
      await client.query('DELETE FROM users WHERE id = $1', [id]);
    }
  } finally {
    await client.end();
  }
});

describe('server-side pagination', () => {
  it('asset-requests returns pagination metadata and respects page/limit', async () => {
    // Seed two requests from our dedicated tech so at least one full page
    // exists for this user.
    for (let i = 0; i < 2; i++) {
      const asset = await createAsset(tech1, otherLabId);
      createdAssets.push(asset.id);
      const res = await tech1.post('/api/asset-requests', {
        assetId: asset.id,
        loanType: 'temporary',
        expectedReturnDate: futureDate(7 + i),
      });
      expect(res.status).toBe(201);
      createdRequests.push(res.body.data.id);
    }

    const page1 = await tech1.get('/api/asset-requests?page=1&limit=1');
    expect(page1.status).toBe(200);
    expect(page1.body.pagination).toEqual({ page: 1, limit: 1 });
    expect(Array.isArray(page1.body.data)).toBe(true);
    expect(page1.body.data).toHaveLength(1);

    const page2 = await tech1.get('/api/asset-requests?page=2&limit=1');
    expect(page2.status).toBe(200);
    expect(page2.body.pagination).toEqual({ page: 2, limit: 1 });
    // Different rows on the two pages
    expect(page2.body.data[0].request.id).not.toBe(page1.body.data[0].request.id);

    // Out-of-range values fall back to the defaults instead of erroring
    const fallback = await tech1.get('/api/asset-requests?page=0&limit=500');
    expect(fallback.status).toBe(200);
    expect(fallback.body.pagination).toEqual({ page: 1, limit: 50 });
  });

  it('asset-loans returns pagination metadata and respects page/limit', async () => {
    const res = await tech1.get('/api/asset-loans?page=1&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 2 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(2);

    // A second page must not repeat rows from the first
    const page2 = await tech1.get('/api/asset-loans?page=2&limit=2');
    expect(page2.body.pagination).toEqual({ page: 2, limit: 2 });
    const page1Ids = new Set(res.body.data.map((row: any) => row.loan.id));
    for (const row of page2.body.data) {
      expect(page1Ids.has(row.loan.id)).toBe(false);
    }
  });

  it('notifications returns pagination metadata and respects page/limit', async () => {
    // Receiving a request creates a notification for the owner college's main
    // technicians — our dedicated main tech must receive one.
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);
    const req = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'temporary',
    });
    expect(req.status).toBe(201);
    createdRequests.push(req.body.data.id);

    const res = await mainTech.get('/api/notifications?page=1&limit=3');
    expect(res.status).toBe(200);
    expect(res.body.pagination).toEqual({ page: 1, limit: 3 });
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeLessThanOrEqual(3);

    // unread=true still works combined with pagination
    const unread = await mainTech.get('/api/notifications?unread=true&page=1&limit=5');
    expect(unread.status).toBe(200);
    expect(unread.body.pagination).toEqual({ page: 1, limit: 5 });
    for (const n of unread.body.data) {
      expect(n.isRead).toBe(false);
    }
  });
});
