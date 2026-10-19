import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { login, cleanupAsset, type ApiClient } from '../helpers';

let admin: ApiClient; let tech: ApiClient;
let csLabId = 0; let techLabId = 0;
const assetIds: number[] = [];

beforeAll(async () => {
  admin = await login('admin@manipal.edu');
  tech = await login('tech1@manipal.edu');
  const { body } = await admin.get('/api/labs?collegeId=all');
  csLabId = body.data.find((lab: any) => lab.code === 'MIT-CS-101').id;
  techLabId = (await tech.get('/api/auth/me')).body.user.labId;
});

afterAll(async () => { while (assetIds.length) await cleanupAsset(assetIds.pop()!); });

async function makeAsset(name: string) {
  const response = await admin.post('/api/assets', { name, category: 'laptop', location: 'Lifecycle test bench', labId: csLabId, status: 'available' });
  expect(response.status).toBe(201); assetIds.push(response.body.id); return response.body;
}

describe('asset soft removal and technician access', () => {
  it('requires a reason, preserves the asset row, and removes it from normal inventory', async () => {
    const asset = await makeAsset(`Lifecycle removal ${Date.now()}`);
    expect((await admin.del(`/api/assets/${asset.id}`)).status).toBe(400);
    const removed = await admin.del(`/api/assets/${asset.id}`, { reason: 'Repair costs exceed replacement value' });
    expect(removed.status).toBe(200);
    expect((await admin.get(`/api/assets/${asset.id}`)).status).toBe(404);
    const inventory = await admin.get('/api/assets?collegeId=all');
    expect(inventory.body.data.some((entry: any) => entry.id === asset.id)).toBe(false);
    const history = await admin.get('/api/assets/removed?collegeId=all');
    const saved = history.body.data.find((entry: any) => entry.asset.id === asset.id);
    expect(saved.asset.removalReason).toBe('Repair costs exceed replacement value');
    expect(saved.removedByName).toBeTruthy();
    expect((await admin.put(`/api/assets/${asset.id}`, { name: asset.name, location: asset.location, category: asset.category })).status).toBe(409);
  });

  it('blocks removal while a borrowing request is pending', async () => {
    const asset = await makeAsset(`Pending request blocker ${Date.now()}`);
    const request = await tech.post('/api/asset-requests', { assetId: asset.id, loanType: 'temporary' });
    expect(request.status).toBe(201);
    const removal = await admin.del(`/api/assets/${asset.id}`, { reason: 'Test blocker' });
    expect(removal.status).toBe(409);
    expect(removal.body.error).toMatch(/pending/i);
  });

  it('limits technicians to their lab inventory and denies direct asset mutations', async () => {
    const response = await tech.get('/api/assets');
    expect(response.status).toBe(200);
    expect(response.body.data.every((asset: any) => asset.labId === techLabId)).toBe(true);
    expect((await tech.post('/api/assets', { name: 'Technician asset', category: 'laptop', location: 'Bench', labId: techLabId })).status).toBe(403);
    expect((await tech.post('/api/assets', { name: 'Technician other-lab asset', category: 'laptop', location: 'Bench', labId: csLabId })).status).toBe(403);
  });
});
