import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { makeClient, login, uniqueEmail, deleteUser } from '../helpers';

let admin: ReturnType<typeof makeClient>;
let tempUserId: number | null = null;

const createTempUser = async (): Promise<{ id: number; email: string; password: string }> => {
  const email = uniqueEmail('temp');
  const password = 'TempPass1';
  const res = await admin.post('/api/users', {
    name: 'Temp Test User',
    email,
    role: 'technician',
    collegeId: 4,
    labId: 6,
    password,
  });
  if (res.status !== 201) {
    throw new Error(`create temp user failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { id: res.body.id, email, password };
};

beforeAll(async () => {
  admin = await login('admin@manipal.edu');
});

afterAll(async () => {
  if (tempUserId) await deleteUser(tempUserId);
});

describe('login', () => {
  it('logs in with valid credentials and stores a session cookie', async () => {
    const client = makeClient();
    const res = await client.post('/api/auth/login', {
      email: 'tech1@manipal.edu',
      password: 'password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('tech1@manipal.edu');
    expect(client.cookie).toContain('session=');

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('technician');
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    const wrongPassword = await makeClient().post('/api/auth/login', {
      email: 'tech1@manipal.edu',
      password: 'wrong-password',
    });
    const unknownEmail = await makeClient().post('/api/auth/login', {
      email: 'nobody@manipal.edu',
      password: 'wrong-password',
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(JSON.stringify(wrongPassword.body)).toBe(JSON.stringify(unknownEmail.body));
  });

  it('rejects missing fields with 400', async () => {
    const res = await makeClient().post('/api/auth/login', { email: 'tech1@manipal.edu' });
    expect(res.status).toBe(400);
  });

  it('throttles per account after repeated failures (unique email)', async () => {
    const email = uniqueEmail('throttle');
    const client = makeClient();
    for (let i = 0; i < 5; i++) {
      const res = await client.post('/api/auth/login', { email, password: 'wrong' });
      expect(res.status).toBe(401);
    }
    const blocked = await client.post('/api/auth/login', { email, password: 'wrong' });
    expect(blocked.status).toBe(429);
  });

  it('throttles per IP after repeated failures', async () => {
    const client = makeClient();
    for (let i = 0; i < 5; i++) {
      const res = await client.post('/api/auth/login', {
        email: `ip-${i}@manipal.edu`,
        password: 'wrong',
      });
      expect(res.status).toBe(401);
    }
    const blocked = await client.post('/api/auth/login', {
      email: 'ip-6@manipal.edu',
      password: 'wrong',
    });
    expect(blocked.status).toBe(429);
  });
});

describe('session revocation', () => {
  it('revokes all sessions when the password is changed', async () => {
    const { id, email, password } = await createTempUser();
    tempUserId = id;

    const user = await login(email, password);

    // Wrong current password is rejected.
    const bad = await user.post('/api/auth/change-password', {
      currentPassword: 'nope',
      newPassword: 'NewPass1',
    });
    expect(bad.status).toBe(400);

    const changed = await user.post('/api/auth/change-password', {
      currentPassword: password,
      newPassword: 'NewPass1',
    });
    expect(changed.status).toBe(200);

    // Existing session is revoked immediately.
    expect((await user.get('/api/auth/me')).status).toBe(401);

    // New password works.
    const relogged = await login(email, 'NewPass1');
    expect((await relogged.get('/api/auth/me')).status).toBe(200);
  });

  it('revokes sessions when an admin resets the password', async () => {
    const { id, email, password } = await createTempUser();
    tempUserId = id;

    const user = await login(email, password);
    expect((await user.get('/api/auth/me')).status).toBe(200);

    const reset = await admin.put(`/api/users/${id}/password`, { newPassword: 'ResetPass1' });
    expect(reset.status).toBe(200);

    expect((await user.get('/api/auth/me')).status).toBe(401);

    const relogged = await login(email, 'ResetPass1');
    expect((await relogged.get('/api/auth/me')).status).toBe(200);
  });
});

describe('disabled accounts', () => {
  it('loses access immediately when disabled and cannot log in again', async () => {
    const { id, email, password } = await createTempUser();
    tempUserId = id;

    const user = await login(email, password);
    expect((await user.get('/api/auth/me')).status).toBe(200);

    const disabled = await admin.put(`/api/users/${id}`, { isActive: false });
    expect(disabled.status).toBe(200);

    // Existing session is dead on the next request.
    expect((await user.get('/api/auth/me')).status).toBe(401);

    // Login is refused.
    const relogin = await makeClient().post('/api/auth/login', { email, password });
    expect(relogin.status).toBe(403);
  });
});