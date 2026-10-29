import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomBytes } from 'crypto';
import { Client } from 'pg';
import { cleanupAsset, login, type ApiClient } from '../helpers';

let requester: ApiClient;
let reviewer: ApiClient;
let otherInstitution: ApiClient;
let sourceLabId: number;
let createdAssets: number[] = [];
let createdRequests: number[] = [];

beforeAll(async () => {
  requester = await login('tech1@manipal.edu');
  reviewer = await login('main.tech@manipal.edu');
  otherInstitution = await login('kmc.tech@manipal.edu');
  const me = await requester.get('/api/auth/me');
  const labs = await requester.get('/api/labs');
  sourceLabId = labs.body.data.find((lab: { id: number }) => lab.id !== me.body.user.labId)?.id;
  if (!sourceLabId) throw new Error('A second lab in the institution is required.');
});

afterEach(async () => {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    for (const id of createdRequests) {
      await client.query('DELETE FROM notifications WHERE related_device_request_id = $1', [id]);
      await client.query("DELETE FROM audit_logs WHERE entity_type = 'device_request' AND entity_id = $1", [id]);
    }
    for (const assetId of createdAssets) await cleanupAsset(assetId);
    for (const id of createdRequests) await client.query('DELETE FROM device_requests WHERE id = $1', [id]);
  } finally {
    createdAssets = [];
    createdRequests = [];
    await client.end();
  }
});

async function createUnits(quantity: number) {
  const name = `Device group ${randomBytes(5).toString('hex')}`;
  for (let index = 0; index < quantity; index++) {
    const response = await requester.post('/api/assets', { name, location: 'Test bench', category: 'laptop', labId: sourceLabId });
    expect(response.status).toBe(201);
    createdAssets.push(response.body.id);
  }
  return name;
}

describe('device type and quantity requests', () => {
  it('lets the main technician choose exact available units and creates temporary loans', async () => {
    const name = await createUnits(2);
    const options = await requester.get('/api/device-requests/options');
    expect(options.status).toBe(200);
    expect(options.body.data.some((option: { name: string; available: number }) => option.name === name && option.available === 2)).toBe(true);

    const expectedReturnDate = new Date(Date.now() + 15 * 86_400_000).toISOString();
    const created = await requester.post('/api/device-requests', { assetName: name, category: 'laptop', model: null, quantity: 2, loanType: 'temporary', expectedReturnDate, notes: 'Test quantity flow' });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    createdRequests.push(id);

    const denied = await otherInstitution.get(`/api/device-requests/${id}/candidates`);
    expect(denied.status).toBe(404);
    const candidates = await reviewer.get(`/api/device-requests/${id}/candidates`);
    expect(candidates.status).toBe(200);
    expect(candidates.body.data.map((asset: { id: number }) => asset.id).sort()).toEqual([...createdAssets].sort());

    const shortSelection = await reviewer.put(`/api/device-requests/${id}`, { action: 'approve', assetIds: [createdAssets[0]] });
    expect(shortSelection.status).toBe(400);
    const approved = await reviewer.put(`/api/device-requests/${id}`, { action: 'approve', assetIds: createdAssets });
    expect(approved.status).toBe(200);
    const duplicate = await reviewer.put(`/api/device-requests/${id}`, { action: 'approve', assetIds: createdAssets });
    expect(duplicate.status).toBe(409);

    const list = await requester.get('/api/device-requests');
    const row = list.body.data.find((item: { request: { id: number } }) => item.request.id === id);
    expect(row.request.status).toBe('approved');
    expect(row.assignedAssets).toHaveLength(2);
    const legacy = await requester.get('/api/asset-requests');
    expect(legacy.body.data.some((item: { request: { deviceRequestId: number | null } }) => item.request.deviceRequestId === id)).toBe(false);
    const loans = await reviewer.get('/api/asset-loans');
    expect(loans.body.data.filter((item: { loan: { assetId: number } }) => createdAssets.includes(item.loan.assetId))).toHaveLength(2);
  });

  it('rejects a quantity larger than available stock', async () => {
    const name = await createUnits(1);
    const response = await requester.post('/api/device-requests', { assetName: name, category: 'laptop', model: null, quantity: 2, loanType: 'temporary' });
    expect(response.status).toBe(409);
  });
});
