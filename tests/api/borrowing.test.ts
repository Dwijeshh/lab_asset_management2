import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { login, createAsset, cleanupAsset, type ApiClient } from '../helpers';

let tech1: ApiClient;
let mainTech: ApiClient;
let admin: ApiClient;
let tech1LabId: number;
let otherLabId: number;

// Assets created by the current test, deleted in afterEach.
const createdAssets: number[] = [];

const futureDate = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

beforeAll(async () => {
  tech1 = await login('tech1@manipal.edu');
  mainTech = await login('main.tech@manipal.edu');
  admin = await login('admin@manipal.edu');

  const me = await tech1.get('/api/auth/me');
  tech1LabId = me.body.user.labId;

  // A lab in tech1's college that is not their own, for requests to target.
  const labs = await tech1.get('/api/labs');
  const other = labs.body.data.find((lab: any) => lab.id !== tech1LabId);
  if (!other) throw new Error('seed has no second MIT lab');
  otherLabId = other.id;
});

afterEach(async () => {
  while (createdAssets.length) {
    await cleanupAsset(createdAssets.pop() as number);
  }
});

describe('request creation', () => {
  it('creates a temporary request with a proposed return date', async () => {
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);

    const res = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'temporary',
      expectedReturnDate: futureDate(30),
    });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.expectedReturnDate).not.toBeNull();
  });

  it('rejects a duplicate pending request for the same asset with 409', async () => {
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);

    const first = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'temporary',
    });
    expect(first.status).toBe(201);

    const second = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'temporary',
    });
    expect(second.status).toBe(409);
  });

  it('validates loan type and return date', async () => {
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);

    const badType = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'forever',
    });
    expect(badType.status).toBe(400);

    const pastDate = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'temporary',
      expectedReturnDate: futureDate(-5),
    });
    expect(pastDate.status).toBe(400);

    const dateOnPermanent = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'permanent',
      expectedReturnDate: futureDate(10),
    });
    expect(dateOnPermanent.status).toBe(400);
  });

  it('rejects a request for an asset already in the requester\'s lab', async () => {
    const asset = await createAsset(tech1, tech1LabId);
    createdAssets.push(asset.id);

    const request = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'temporary',
    });
    expect(request.status).toBe(400);
  });
});

describe('approval and return', () => {
  it('approves a request, creates a loan, marks the asset in_use, and returns it', async () => {
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);

    const created = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'temporary',
      expectedReturnDate: futureDate(30),
    });
    expect(created.status).toBe(201);
    const requestId = created.body.data.id;

    // The main technician sees the pending request.
    const list = await mainTech.get('/api/asset-requests');
    expect(list.status).toBe(200);
    expect(list.body.data.some((r: any) => r.request.id === requestId)).toBe(true);

    // Approve with an override date.
    const approved = await mainTech.put(`/api/asset-requests/${requestId}`, {
      action: 'approve',
      expectedReturnDate: futureDate(60),
    });
    expect(approved.status).toBe(200);

    // Double approval is rejected.
    const doubleApprove = await mainTech.put(`/api/asset-requests/${requestId}`, {
      action: 'approve',
    });
    expect(doubleApprove.status).toBe(400);

    // Asset is now in_use.
    const assetAfter = await admin.get(`/api/assets/${asset.id}`);
    expect(assetAfter.body.status).toBe('in_use');

    // A loan exists with the approver's return date.
    const loans = await mainTech.get('/api/asset-loans');
    const loan = loans.body.data.find((l: any) => l.loan.requestId === requestId);
    expect(loan).toBeDefined();
    expect(loan.loan.status).toBe('active');

    // Return the loan: asset goes back to available.
    const returned = await mainTech.put(`/api/asset-loans/${loan.loan.id}`, {});
    expect(returned.status).toBe(200);

    const assetFinal = await admin.get(`/api/assets/${asset.id}`);
    expect(assetFinal.body.status).toBe('available');

    // Returning again is rejected.
    const again = await mainTech.put(`/api/asset-loans/${loan.loan.id}`, {});
    expect(again.status).toBe(400);
  });
});

describe('permanent transfer', () => {
  it('moves the asset to the requester\'s lab and keeps it available', async () => {
    const asset = await createAsset(tech1, otherLabId);
    createdAssets.push(asset.id);

    const created = await tech1.post('/api/asset-requests', {
      assetId: asset.id,
      loanType: 'permanent',
    });
    expect(created.status).toBe(201);
    const requestId = created.body.data.id;

    const approved = await mainTech.put(`/api/asset-requests/${requestId}`, { action: 'approve' });
    expect(approved.status).toBe(200);

    const assetAfter = await admin.get(`/api/assets/${asset.id}`);
    expect(assetAfter.body.labId).toBe(tech1LabId);
    expect(assetAfter.body.collegeId).toBe(4);
    expect(assetAfter.body.status).toBe('available');
  });
});