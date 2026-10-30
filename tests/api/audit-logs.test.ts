import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { cleanupAsset, createAsset, login, type ApiClient } from '../helpers';

let admin: ApiClient;
let mainTech: ApiClient;
let technician: ApiClient;
let mitId: number;
let otherId: number;
const insertedIds: number[] = [];
const createdAssets: number[] = [];

beforeAll(async () => {
  admin = await login('admin@manipal.edu');
  mainTech = await login('main.tech@manipal.edu');
  technician = await login('tech1@manipal.edu');
  mitId = (await mainTech.get('/api/auth/me')).body.user.collegeId;
  const institutions = (await admin.get('/api/colleges')).body.data;
  otherId = institutions.find((college: { id: number }) => college.id !== mitId)?.id;
  if (!otherId) throw new Error('A second institution is needed for the isolation test.');

  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const [collegeId, relatedCollegeId, action] of [
      [mitId, null, 'CREATE'], [otherId, null, 'DELETE'], [mitId, otherId, 'UPDATE'], [null, null, 'APPROVE'],
    ] as const) {
      const result = await client.query(
        `INSERT INTO audit_logs (college_id, related_college_id, action, entity_type, entity_id, changes)
         VALUES ($1, $2, $3, 'lab', 999999, '{"testAuditScope":true}') RETURNING id`,
        [collegeId, relatedCollegeId, action],
      );
      insertedIds.push(result.rows[0].id);
    }
  } finally { await client.end(); }
});

afterAll(async () => {
  for (const id of createdAssets) await cleanupAsset(id);
  if (!insertedIds.length) return;
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  try { await client.query('DELETE FROM audit_logs WHERE id = ANY($1::int[])', [insertedIds]); }
  finally { await client.end(); }
});

const visibleIds = (body: { data: { id: number }[] }) => new Set(body.data.map(row => row.id));

describe('activity log access', () => {
  it('restricts technicians and keeps main technicians within their institution', async () => {
    expect((await technician.get('/api/audit-logs')).status).toBe(403);
    const response = await mainTech.get(`/api/audit-logs?collegeId=${otherId}&limit=100`);
    expect(response.status).toBe(200);
    const ids = visibleIds(response.body);
    expect(ids.has(insertedIds[0])).toBe(true);
    expect(ids.has(insertedIds[1])).toBe(false);
    expect(ids.has(insertedIds[2])).toBe(true);
    expect(ids.has(insertedIds[3])).toBe(false);
  });

  it('lets administrators view all institutions or filter one, including a shared move', async () => {
    const all = await admin.get('/api/audit-logs?limit=100');
    expect(all.status).toBe(200);
    for (const id of insertedIds) expect(visibleIds(all.body).has(id)).toBe(true);

    const filtered = await admin.get(`/api/audit-logs?collegeId=${otherId}&limit=100`);
    const ids = visibleIds(filtered.body);
    expect(ids.has(insertedIds[0])).toBe(false);
    expect(ids.has(insertedIds[1])).toBe(true);
    expect(ids.has(insertedIds[2])).toBe(true);
    expect(ids.has(insertedIds[3])).toBe(false);
  });

  it('records an asset change under its institution rather than the actor alone', async () => {
    const me = await technician.get('/api/auth/me');
    const asset = await createAsset(technician, me.body.user.labId);
    createdAssets.push(asset.id);
    const response = await mainTech.get('/api/audit-logs?entityType=asset&action=CREATE&limit=100');
    expect(response.status).toBe(200);
    const event = response.body.data.find((row: { entityId: number }) => row.entityId === asset.id);
    expect(event?.collegeId).toBe(mitId);
  });
});
