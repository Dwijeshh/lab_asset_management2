import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { cleanupAsset, login, type ApiClient } from '../helpers';

let admin: ApiClient;
let tech: ApiClient;
let assignedHead: ApiClient;
let unassignedHead: ApiClient;
let labId: number;
let otherLabId: number;
let otherCollegeLabId: number;
let assetId: number;
let requestId: number;
const requestIds: number[] = [];
const assetIds: number[] = [];

async function dbClient() {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  return client;
}

async function submitRequest(proposedChanges: Record<string, unknown>, reason = 'Correct the equipment record') {
  return tech.post('/api/asset-modification-requests', { assetId, proposedChanges, reason });
}

beforeAll(async () => {
  admin = await login('admin@manipal.edu');
  tech = await login('tech1@manipal.edu');
  assignedHead = await login('main.tech@manipal.edu');
  unassignedHead = await login('main.tech2@manipal.edu');
  const labs = (await admin.get('/api/labs?collegeId=all')).body.data;
  labId = labs.find((lab: any) => lab.code === 'MIT-ECE-204').id;
  otherLabId = labs.find((lab: any) => lab.code === 'MIT-CS-101').id;
  otherCollegeLabId = labs.find((lab: any) => lab.code === 'KMC-SIM-101').id;
  const asset = await admin.post('/api/assets', {
    name: `Modification request asset ${Date.now()}`,
    category: 'laptop', location: 'ECE bench', labId,
  });
  expect(asset.status).toBe(201);
  assetId = asset.body.id;
  assetIds.push(assetId);
});

afterAll(async () => {
  const client = await dbClient();
  try {
    if (requestIds.length) await client.query('DELETE FROM asset_modification_requests WHERE id = ANY($1::int[])', [requestIds]);
  } finally {
    await client.end();
  }
  while (assetIds.length) await cleanupAsset(assetIds.pop() as number);
});

describe('asset modification request submission and visibility', () => {
  it('allows a technician to request an edit in their lab without changing the asset', async () => {
    const before = await admin.get(`/api/assets/${assetId}`);
    const response = await submitRequest({ name: 'Corrected asset name', notes: 'Label verified' });
    expect(response.status).toBe(201);
    requestId = response.body.data.id;
    requestIds.push(requestId);
    expect(response.body.data.proposedChanges).toEqual({ name: 'Corrected asset name', notes: 'Label verified' });
    expect(response.body.data.originalValues).toEqual({ name: before.body.name, notes: null });
    expect((await admin.get(`/api/assets/${assetId}`)).body.name).toBe(before.body.name);
  });

  it('rejects missing reasons, no-op edits, unknown fields, and system-managed fields', async () => {
    expect((await tech.post('/api/asset-modification-requests', { assetId, proposedChanges: { name: 'x' } })).status).toBe(400);
    expect((await submitRequest({ name: (await admin.get(`/api/assets/${assetId}`)).body.name })).status).toBe(400);
    expect((await submitRequest({ name: 'attempt', createdById: 1 })).status).toBe(400);
    expect((await submitRequest({ labId })).status).toBe(400);
  });

  it('blocks requests for assets outside the technician lab and college', async () => {
    const other = await admin.post('/api/assets', { name: 'Other lab asset', category: 'laptop', location: 'CS bench', labId: otherLabId });
    expect(other.status).toBe(201);
    assetIds.push(other.body.id);
    const outsideLab = await tech.post('/api/asset-modification-requests', { assetId: other.body.id, proposedChanges: { name: 'No' }, reason: 'No' });
    expect(outsideLab.status).toBe(403);
    const adminSubmit = await admin.post('/api/asset-modification-requests', { assetId, proposedChanges: { name: 'No' }, reason: 'No' });
    expect(adminSubmit.status).toBe(403);

    const otherCollegeAsset = await admin.post('/api/assets', { name: 'Other college asset', category: 'laptop', location: 'KMC bench', labId: otherCollegeLabId });
    expect(otherCollegeAsset.status).toBe(201);
    assetIds.push(otherCollegeAsset.body.id);
    const outsideCollege = await tech.post('/api/asset-modification-requests', { assetId: otherCollegeAsset.body.id, proposedChanges: { name: 'No' }, reason: 'No' });
    expect(outsideCollege.status).toBe(403);
  });

  it('limits list and detail visibility to the requester, assigned head technicians, and admins', async () => {
    expect((await tech.get(`/api/asset-modification-requests/${requestId}`)).status).toBe(200);
    expect((await assignedHead.get(`/api/asset-modification-requests/${requestId}`)).status).toBe(200);
    expect((await unassignedHead.get(`/api/asset-modification-requests/${requestId}`)).status).toBe(403);
    expect((await admin.get(`/api/asset-modification-requests/${requestId}`)).status).toBe(200);
    const techList = await tech.get('/api/asset-modification-requests');
    expect(techList.status).toBe(200);
    expect(techList.body.data.some((row: any) => row.request.id === requestId)).toBe(true);
  });

  it('blocks technicians and unassigned head technicians from reviewing, then applies approval', async () => {
    expect((await tech.post(`/api/asset-modification-requests/${requestId}/approve`, {})).status).toBe(403);
    expect((await unassignedHead.post(`/api/asset-modification-requests/${requestId}/approve`, {})).status).toBe(403);
    const approved = await assignedHead.post(`/api/asset-modification-requests/${requestId}/approve`, { reviewNote: 'Verified' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('approved');
    const asset = await admin.get(`/api/assets/${assetId}`);
    expect(asset.body.name).toBe('Corrected asset name');
    expect(asset.body.notes).toBe('Label verified');
    expect((await assignedHead.post(`/api/asset-modification-requests/${requestId}/approve`, {})).status).toBe(409);
  });

  it('checks a head technician assignment against the database at review time', async () => {
    const created = await admin.post('/api/assets', { name: 'Assignment removal check', category: 'laptop', location: 'ECE bench', labId });
    expect(created.status).toBe(201);
    assetIds.push(created.body.id);
    const response = await tech.post('/api/asset-modification-requests', { assetId: created.body.id, proposedChanges: { name: 'Assignment removal proposed name' }, reason: 'Correct the name' });
    expect(response.status).toBe(201);
    requestIds.push(response.body.data.id);

    const removed = await admin.del(`/api/users/${(await assignedHead.get('/api/auth/me')).body.user.id}/labs?labId=${labId}`);
    expect(removed.status).toBe(200);
    try {
      const denied = await assignedHead.post(`/api/asset-modification-requests/${response.body.data.id}/approve`, {});
      expect(denied.status).toBe(403);
    } finally {
      const restored = await admin.post(`/api/users/${(await assignedHead.get('/api/auth/me')).body.user.id}/labs`, { labId });
      expect([201, 409]).toContain(restored.status);
    }
  });

  it('rejects stale proposals without overwriting newer asset data', async () => {
    const created = await admin.post('/api/assets', { name: 'Conflict source', category: 'laptop', location: 'ECE bench', labId });
    expect(created.status).toBe(201);
    assetIds.push(created.body.id);
    const response = await tech.post('/api/asset-modification-requests', { assetId: created.body.id, proposedChanges: { name: 'Technician proposal' }, reason: 'Update name' });
    expect(response.status).toBe(201);
    requestIds.push(response.body.data.id);
    await admin.put(`/api/assets/${created.body.id}`, { name: 'Admin change', category: 'laptop', location: 'ECE bench', labId, status: 'available' });
    const conflict = await assignedHead.post(`/api/asset-modification-requests/${response.body.data.id}/approve`, {});
    expect(conflict.status).toBe(409);
    expect((await admin.get(`/api/assets/${created.body.id}`)).body.name).toBe('Admin change');
  });

  it('records admin rejections without changing the asset', async () => {
    const created = await admin.post('/api/assets', { name: 'Rejected source', category: 'laptop', location: 'ECE bench', labId });
    expect(created.status).toBe(201);
    assetIds.push(created.body.id);
    const response = await tech.post('/api/asset-modification-requests', { assetId: created.body.id, proposedChanges: { location: 'New bench' }, reason: 'Moved the equipment' });
    expect(response.status).toBe(201);
    requestIds.push(response.body.data.id);
    const rejected = await admin.post(`/api/asset-modification-requests/${response.body.data.id}/reject`, { reviewNote: 'Location is already correct' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('rejected');
    expect((await admin.get(`/api/assets/${created.body.id}`)).body.location).toBe('ECE bench');
  });

  it('preserves request history and its asset link after soft removal', async () => {
    const created = await admin.post('/api/assets', { name: 'Deleted asset snapshot', category: 'laptop', location: 'ECE bench', labId });
    expect(created.status).toBe(201);
    assetIds.push(created.body.id);
    const response = await tech.post('/api/asset-modification-requests', { assetId: created.body.id, proposedChanges: { location: 'Another bench' }, reason: 'The asset moved' });
    expect(response.status).toBe(201);
    requestIds.push(response.body.data.id);
    expect((await admin.del(`/api/assets/${created.body.id}`, { reason: 'Removed after being damaged' })).status).toBe(200);
    const history = await tech.get(`/api/asset-modification-requests/${response.body.data.id}`);
    expect(history.status).toBe(200);
    expect(history.body.data.request.assetId).toBe(created.body.id);
    expect(history.body.data.request.assetName).toBe('Deleted asset snapshot');
    expect(history.body.data.asset).toEqual({ id: created.body.id, name: 'Deleted asset snapshot' });
  });
});
