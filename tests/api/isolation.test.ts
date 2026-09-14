import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { makeClient, login, rejectAllPending, createAsset, cleanupAsset } from '../helpers';

let tech1: ReturnType<typeof makeClient>;
let kmcTech: ReturnType<typeof makeClient>;
let admin: ReturnType<typeof makeClient>;
let tech1LabId: number;

beforeAll(async () => {
  tech1 = await login('tech1@manipal.edu');
  kmcTech = await login('kmc.tech@manipal.edu');
  admin = await login('admin@manipal.edu');
  const me = await tech1.get('/api/auth/me');
  tech1LabId = me.body.user.labId;
});

describe('list scoping', () => {
  it('returns only the technician\'s own college assets', async () => {
    const res = await tech1.get('/api/assets');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const asset of res.body.data) {
      expect(asset.collegeId).toBe(4);
    }
  });

  it('ignores a forged collegeId filter for non-admins', async () => {
    const res = await tech1.get('/api/assets?collegeId=5');
    expect(res.status).toBe(200);
    for (const asset of res.body.data) {
      expect(asset.collegeId).toBe(4);
    }
  });

  it('lets admins see all colleges and rejects malformed filters with 400', async () => {
    const all = await admin.get('/api/assets?collegeId=all');
    expect(all.status).toBe(200);
    const colleges = new Set(all.body.data.map((a: any) => a.collegeId));
    expect(colleges.size).toBeGreaterThan(1);

    const bad = await admin.get('/api/assets?collegeId=abc');
    expect(bad.status).toBe(400);
  });

  it('scopes labs to the user\'s college', async () => {
    const mit = await tech1.get('/api/labs');
    expect(mit.status).toBe(200);
    for (const lab of mit.body.data) expect(lab.collegeId).toBe(4);

    const kmc = await kmcTech.get('/api/labs');
    for (const lab of kmc.body.data) expect(lab.collegeId).toBe(5);
  });
});

describe('record-level isolation', () => {
  let kmcAssetId: number | null = null;
  let kmcLabId: number | null = null;
  let mitAsset: any = null;

  beforeAll(async () => {
    const all = await admin.get('/api/assets?collegeId=all');
    kmcAssetId = all.body.data.find((a: any) => a.collegeId === 5)?.id;
    const kmcLabs = await admin.get('/api/labs?collegeId=5');
    kmcLabId = kmcLabs.body.data[0].id;
    const mit = await tech1.get('/api/assets');
    mitAsset = mit.body.data.find((a: any) => a.status === 'available');
    if (!kmcAssetId || !kmcLabId || !mitAsset) {
      throw new Error('seed data missing for isolation tests');
    }
  });

  it('hides another college\'s asset (404, not 403)', async () => {
    const res = await tech1.get(`/api/assets/${kmcAssetId}`);
    expect(res.status).toBe(404);
  });

  it('blocks creating an asset in another college\'s lab', async () => {
    const res = await tech1.post('/api/assets', {
      name: 'Isolation Probe',
      location: 'Test',
      category: 'laptop',
      labId: kmcLabId,
    });
    expect(res.status).toBe(403);
  });

  it('blocks moving an asset into another college\'s lab', async () => {
    const res = await tech1.put(`/api/assets/${mitAsset.id}`, {
      name: mitAsset.name,
      location: mitAsset.location,
      category: mitAsset.category,
      status: mitAsset.status,
      labId: kmcLabId,
    });
    expect(res.status).toBe(403);
  });

  it('keeps collegeId in sync when an admin moves an asset between colleges', async () => {
    // Move MIT asset to the KMC lab, then back.
    const moved = await admin.put(`/api/assets/${mitAsset.id}`, {
      name: mitAsset.name,
      location: mitAsset.location,
      category: mitAsset.category,
      status: mitAsset.status,
      labId: kmcLabId,
    });
    expect(moved.status).toBe(200);
    expect(moved.body.collegeId).toBe(5);

    const back = await admin.put(`/api/assets/${mitAsset.id}`, {
      name: mitAsset.name,
      location: mitAsset.location,
      category: mitAsset.category,
      status: mitAsset.status,
      labId: mitAsset.labId,
    });
    expect(back.status).toBe(200);
    expect(back.body.collegeId).toBe(4);
  });
});

describe('cross-college borrowing', () => {
  let mitMain: ReturnType<typeof makeClient>;
  const createdAssets: number[] = [];

  beforeAll(async () => {
    mitMain = await login('main.tech@manipal.edu');
    await rejectAllPending(mitMain);
  });

  afterEach(async () => {
    while (createdAssets.length) {
      await cleanupAsset(createdAssets.pop() as number);
    }
  });

  it('blocks a KMC technician from requesting an MIT asset', async () => {
    const target = await createAsset(tech1, tech1LabId === 6 ? 7 : 6);
    createdAssets.push(target.id);

    const res = await kmcTech.post('/api/asset-requests', {
      assetId: target.id,
      loanType: 'temporary',
    });
    expect(res.status).toBe(403);
  });

  it('blocks a KMC main technician from approving an MIT request', async () => {
    const target = await createAsset(tech1, tech1LabId === 6 ? 7 : 6);
    createdAssets.push(target.id);

    const created = await tech1.post('/api/asset-requests', {
      assetId: target.id,
      loanType: 'temporary',
    });
    expect(created.status).toBe(201);
    const requestId = created.body.data.id;

    const kmcMain = await login('kmc.tech@manipal.edu');
    const denied = await kmcMain.put(`/api/asset-requests/${requestId}`, { action: 'approve' });
    expect(denied.status).toBe(403);

    // Cleanup: reject the request as the MIT main technician.
    const rejected = await mitMain.put(`/api/asset-requests/${requestId}`, { action: 'reject' });
    expect(rejected.status).toBe(200);
  });
});