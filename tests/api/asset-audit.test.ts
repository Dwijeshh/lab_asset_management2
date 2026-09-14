import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, createAsset, cleanupAsset, type ApiClient } from '../helpers';

let tech1: ApiClient;
let admin: ApiClient;
let tech1LabId: number;
let otherLabId: number;

// Assets created by this suite; removed again in afterAll so the run stays
// non-destructive against a shared database.
const createdAssets: number[] = [];

async function latestAudit(assetId: number, action: string): Promise<Record<string, any> | null> {
  const { Client } = await import('pg');
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  try {
    const res = await client.query(
      `SELECT changes FROM audit_logs
       WHERE entity_type = 'asset' AND entity_id = $1 AND action = $2
       ORDER BY id DESC LIMIT 1`,
      [assetId, action]
    );
    return res.rows[0] ? JSON.parse(res.rows[0].changes) : null;
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  tech1 = await login('tech1@manipal.edu');
  admin = await login('admin@manipal.edu');

  const me = await tech1.get('/api/auth/me');
  tech1LabId = me.body.user.labId;

  const labs = await tech1.get('/api/labs');
  const other = labs.body.data.find((lab: any) => lab.id !== tech1LabId);
  if (!other) throw new Error('seed has no second MIT lab');
  otherLabId = other.id;
});

afterAll(async () => {
  while (createdAssets.length) {
    await cleanupAsset(createdAssets.pop() as number);
  }
});

describe('asset audit trail', () => {
  it('writes a CREATE entry when an asset is created', async () => {
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);

    const changes = await latestAudit(asset.id, 'CREATE');
    expect(changes).not.toBeNull();
    expect(changes!.name).toBe(asset.name);
    expect(changes!.collegeId).toBe(asset.collegeId);
    expect(changes!.labId).toBe(asset.labId);
  });

  it('writes an UPDATE entry containing only the changed fields', async () => {
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);

    const updated = await tech1.put(`/api/assets/${asset.id}`, {
      name: asset.name,
      location: 'Moved bench',
      category: asset.category,
      status: asset.status,
    });
    expect(updated.status).toBe(200);

    const changes = await latestAudit(asset.id, 'UPDATE');
    expect(changes).not.toBeNull();
    expect(changes!.location).toEqual({ from: 'Test bench', to: 'Moved bench' });
    // unchanged fields are not recorded
    expect(changes!.name).toBeUndefined();
    expect(changes!.category).toBeUndefined();
  });

  it('writes a DELETE entry snapshotting the asset', async () => {
    const asset = await createAsset(tech1, otherLabId);

    // technicians cannot delete; the admin client is the fallback
    const del = await tech1.del(`/api/assets/${asset.id}`);
    if (del.status === 403) {
      const adminDel = await admin.del(`/api/assets/${asset.id}`);
      expect(adminDel.status).toBe(200);
    } else {
      expect(del.status).toBe(200);
    }

    const changes = await latestAudit(asset.id, 'DELETE');
    expect(changes).not.toBeNull();
    expect(changes!.name).toBe(asset.name);
    expect(changes!.collegeId).toBe(asset.collegeId);
  });
});
