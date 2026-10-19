import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { login, cleanupAsset, type ApiClient } from '../helpers';
import { Client } from 'pg';

let admin: ApiClient;
let mainTech1: ApiClient;
let mainTech2: ApiClient;
let tech1: ApiClient;

let mainTech1Id: number;
let mainTech2Id: number;
let tech1Id: number;
let adminId: number;

let csLabId: number;
let eceLabId: number;
let mechLabId: number;
let kmcLabId: number;

const createdAssets: number[] = [];

async function getDbClient() {
  const client = new Client({
    connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
  });
  await client.connect();
  return client;
}

beforeAll(async () => {
  admin = await login('admin@manipal.edu');
  mainTech1 = await login('main.tech@manipal.edu');
  mainTech2 = await login('main.tech2@manipal.edu');
  tech1 = await login('tech1@manipal.edu');

  const meAdmin = await admin.get('/api/auth/me');
  adminId = meAdmin.body.user.id;

  const me1 = await mainTech1.get('/api/auth/me');
  mainTech1Id = me1.body.user.id;

  const me2 = await mainTech2.get('/api/auth/me');
  mainTech2Id = me2.body.user.id;

  const meTech = await tech1.get('/api/auth/me');
  tech1Id = meTech.body.user.id;

  const labsRes = await admin.get('/api/labs?collegeId=all');
  const allLabs = labsRes.body.data;
  csLabId = allLabs.find((l: any) => l.code === 'MIT-CS-101').id;
  eceLabId = allLabs.find((l: any) => l.code === 'MIT-ECE-204').id;
  mechLabId = allLabs.find((l: any) => l.code === 'MIT-MECH-305').id;
  kmcLabId = allLabs.find((l: any) => l.code === 'KMC-SIM-101').id;
});

afterAll(async () => {
  while (createdAssets.length) {
    await cleanupAsset(createdAssets.pop() as number);
  }
});

describe('Technician read-only permissions', () => {
  it('blocks a technician from creating an asset (403)', async () => {
    const res = await tech1.post('/api/assets', {
      name: 'Tech Created Asset',
      location: 'Bench 1',
      category: 'laptop',
      labId: csLabId,
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You are not assigned to this lab');
  });

  it('blocks a technician from updating an asset (403)', async () => {
    // Create an asset as admin first
    const createRes = await admin.post('/api/assets', {
      name: 'Admin Asset for Tech Update Test',
      location: 'Bench 1',
      category: 'laptop',
      labId: csLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    const res = await tech1.put(`/api/assets/${createRes.body.id}`, {
      name: 'Tampered Asset Name',
      location: 'Bench 2',
      category: 'laptop',
      labId: csLabId,
      status: 'available',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You are not assigned to this lab');
  });

  it('blocks a technician from deleting an asset (403)', async () => {
    // Create an asset as admin first
    const createRes = await admin.post('/api/assets', {
      name: 'Admin Asset for Tech Delete Test',
      location: 'Bench 1',
      category: 'laptop',
      labId: csLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    const res = await tech1.del(`/api/assets/${createRes.body.id}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You are not assigned to this lab');
  });
});

describe('Head technician assigned vs unassigned lab permissions', () => {
  it('allows head technician to create, update, and delete in an assigned lab', async () => {
    // mainTech1 is assigned to csLabId
    const createRes = await mainTech1.post('/api/assets', {
      name: 'Head Tech Asset in CS Lab',
      location: 'Bench A1',
      category: 'laptop',
      labId: csLabId,
    });
    expect(createRes.status).toBe(201);
    const assetId = createRes.body.id;

    // Update in csLabId
    const updateRes = await mainTech1.put(`/api/assets/${assetId}`, {
      name: 'Head Tech Asset in CS Lab (Updated)',
      location: 'Bench A2',
      category: 'laptop',
      labId: csLabId,
      status: 'available',
    });
    expect(updateRes.status).toBe(200);

    // Delete in csLabId
    const deleteRes = await mainTech1.del(`/api/assets/${assetId}`, { reason: 'Permission test cleanup' });
    expect(deleteRes.status).toBe(200);
  });

  it('blocks head technician from creating an asset in an unassigned lab (403)', async () => {
    // mainTech1 is NOT assigned to mechLabId
    const res = await mainTech1.post('/api/assets', {
      name: 'Forbidden Asset in Mech Lab',
      location: 'Bay 1',
      category: 'lathe_machine',
      labId: mechLabId,
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You are not assigned to this lab');
  });

  it('blocks head technician from updating an asset in an unassigned lab (403)', async () => {
    // mainTech2 is assigned to mechLabId, so create as mainTech2
    const createRes = await mainTech2.post('/api/assets', {
      name: 'Mech Lab Machine',
      location: 'Bay 1',
      category: 'lathe_machine',
      labId: mechLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    // mainTech1 attempts to edit it
    const res = await mainTech1.put(`/api/assets/${createRes.body.id}`, {
      name: 'Hacked Mech Machine',
      location: 'Bay 2',
      category: 'lathe_machine',
      labId: mechLabId,
      status: 'available',
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You are not assigned to this lab');
  });

  it('blocks head technician from deleting an asset in an unassigned lab (403)', async () => {
    const createRes = await mainTech2.post('/api/assets', {
      name: 'Mech Lab Machine 2',
      location: 'Bay 1',
      category: 'lathe_machine',
      labId: mechLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    // mainTech1 attempts to delete it
    const res = await mainTech1.del(`/api/assets/${createRes.body.id}`, { reason: 'Permission test cleanup' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('You are not assigned to this lab');
  });
});

describe('Moving assets between labs requires managing BOTH labs', () => {
  it('allows head technician to move asset between two assigned labs', async () => {
    // mainTech1 manages csLabId AND eceLabId
    const createRes = await mainTech1.post('/api/assets', {
      name: 'Movable Oscilloscope',
      location: 'CS Rack',
      category: 'oscilloscope',
      labId: csLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    // Move to ECE Lab
    const moveRes = await mainTech1.put(`/api/assets/${createRes.body.id}`, {
      name: 'Movable Oscilloscope',
      location: 'ECE Bench 1',
      category: 'oscilloscope',
      labId: eceLabId,
      status: 'available',
    });
    expect(moveRes.status).toBe(200);
    expect(moveRes.body.labId).toBe(eceLabId);
  });

  it('blocks head technician from moving an asset from an assigned lab into an unassigned lab (403)', async () => {
    // mainTech1 manages csLabId but NOT mechLabId
    const createRes = await mainTech1.post('/api/assets', {
      name: 'Stationary Monitor',
      location: 'CS Room',
      category: 'monitor',
      labId: csLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    const moveRes = await mainTech1.put(`/api/assets/${createRes.body.id}`, {
      name: 'Stationary Monitor',
      location: 'Mech Floor',
      category: 'monitor',
      labId: mechLabId,
      status: 'available',
    });
    expect(moveRes.status).toBe(403);
    expect(moveRes.body.error).toBe('You are not assigned to this lab');
  });

  it('blocks head technician from moving an asset from an unassigned lab into an assigned lab (403)', async () => {
    // mainTech2 only manages mechLabId, attempts to move to csLabId (not assigned)
    const createRes = await mainTech2.post('/api/assets', {
      name: 'Mech Asset to CS',
      location: 'Mech Floor',
      category: 'other',
      labId: mechLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    const moveRes = await mainTech2.put(`/api/assets/${createRes.body.id}`, {
      name: 'Mech Asset to CS',
      location: 'CS Room',
      category: 'other',
      labId: csLabId,
      status: 'available',
    });
    expect(moveRes.status).toBe(403);
    expect(moveRes.body.error).toBe('You are not assigned to this lab');
  });
});

describe('Admin lab assignment endpoints', () => {
  it('allows admin to list, assign, and unassign labs for a head technician', async () => {
    // List initial labs for mainTech2 (should have mechLabId)
    const listRes = await admin.get(`/api/users/${mainTech2Id}/labs`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.labs.some((l: any) => l.id === mechLabId)).toBe(true);

    // Assign csLabId to mainTech2
    const assignRes = await admin.post(`/api/users/${mainTech2Id}/labs`, { labId: csLabId });
    expect(assignRes.status).toBe(201);

    // Verify mainTech2 can now create in csLabId
    const createRes = await mainTech2.post('/api/assets', {
      name: 'Asset by newly assigned mainTech2',
      location: 'Desk 1',
      category: 'laptop',
      labId: csLabId,
    });
    expect(createRes.status).toBe(201);
    createdAssets.push(createRes.body.id);

    // Unassign csLabId from mainTech2
    const unassignRes = await admin.del(`/api/users/${mainTech2Id}/labs`, { labId: csLabId });
    expect(unassignRes.status).toBe(200);

    // Verify mainTech2 can no longer create in csLabId
    const forbidRes = await mainTech2.post('/api/assets', {
      name: 'Asset after unassign',
      location: 'Desk 1',
      category: 'laptop',
      labId: csLabId,
    });
    expect(forbidRes.status).toBe(403);
  });

  it('rejects assigning a lab to a non-head-technician (400)', async () => {
    const res = await admin.post(`/api/users/${tech1Id}/labs`, { labId: csLabId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/main.?technician/i);
  });

  it('rejects assigning a lab from a different college (400)', async () => {
    // mainTech1 is in MIT, kmcLabId is in KMC
    const res = await admin.post(`/api/users/${mainTech1Id}/labs`, { labId: kmcLabId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/college/i);
  });

  it('blocks non-admins from assigning or unassigning labs (403)', async () => {
    const assignRes = await mainTech1.post(`/api/users/${mainTech2Id}/labs`, { labId: csLabId });
    expect(assignRes.status).toBe(403);

    const unassignRes = await tech1.del(`/api/users/${mainTech2Id}/labs?labId=${mechLabId}`);
    expect(unassignRes.status).toBe(403);
  });
});

describe('Notification recipients on asset changes', () => {
  it('notifies active admins, lab technicians, and other assigned head technicians (and not the actor)', async () => {
    const dbClient = await getDbClient();
    try {
      // Clear recent notifications for clean assertion
      await dbClient.query('DELETE FROM notifications');

      // Head Tech 1 creates an asset in ECE Lab (managed by mainTech1, technician tech1 is in eceLabId)
      // First ensure mainTech2 is also assigned to ECE Lab to test "other head technicians"
      await admin.post(`/api/users/${mainTech2Id}/labs`, { labId: eceLabId });
      await dbClient.query('DELETE FROM notifications');

      const createRes = await mainTech1.post('/api/assets', {
        name: 'Notifier Laptop',
        location: 'ECE Corner',
        category: 'laptop',
        labId: eceLabId,
      });
      expect(createRes.status).toBe(201);
      const assetId = createRes.body.id;
      createdAssets.push(assetId);

      // Check notifications created
      const notifsRes = await dbClient.query('SELECT user_id, type, message FROM notifications');
      const recipientIds = notifsRes.rows.map((r: any) => r.user_id);

      // Active admins must receive notification
      expect(recipientIds).toContain(adminId);
      // Lab technician in eceLabId (tech1) must receive notification
      expect(recipientIds).toContain(tech1Id);
      // Other head technician assigned to eceLabId (mainTech2) must receive notification
      expect(recipientIds).toContain(mainTech2Id);
      // The actor (mainTech1) must NOT receive notification
      expect(recipientIds).not.toContain(mainTech1Id);

      const sampleNotif = notifsRes.rows.find((r: any) => r.user_id === tech1Id);
      expect(sampleNotif.type).toBe('asset_created');
      expect(sampleNotif.message).toContain('Notifier Laptop');
      expect(sampleNotif.message).toContain('was added by');

      // Now test UPDATE notification with changed fields and lab move
      await dbClient.query('DELETE FROM notifications');

      // Move asset from eceLabId to csLabId (mainTech1 is assigned to both)
      const updateRes = await mainTech1.put(`/api/assets/${assetId}`, {
        name: 'Notifier Laptop',
        location: 'CS Corner',
        category: 'laptop',
        labId: csLabId,
        status: 'available',
      });
      expect(updateRes.status).toBe(200);

      const updateNotifs = await dbClient.query('SELECT user_id, type, message FROM notifications');
      const updateRecipientIds = updateNotifs.rows.map((r: any) => r.user_id);

      // Both eceLabId tech (tech1) and admin should be notified on move
      expect(updateRecipientIds).toContain(adminId);
      expect(updateRecipientIds).toContain(tech1Id);
      // Actor should not be notified
      expect(updateRecipientIds).not.toContain(mainTech1Id);

      const sampleUpdateNotif = updateNotifs.rows[0];
      expect(sampleUpdateNotif.type).toBe('asset_updated');
      expect(sampleUpdateNotif.message).toContain('was updated by');
      expect(sampleUpdateNotif.message.toLowerCase()).toContain('location');

      // Clean up the temporary assignment
      await admin.del(`/api/users/${mainTech2Id}/labs?labId=${eceLabId}`);
    } finally {
      await dbClient.end();
    }
  });
});
