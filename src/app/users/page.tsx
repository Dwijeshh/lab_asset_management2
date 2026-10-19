'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { useSession, ROLE_LABELS, ROLE_COLORS } from '@/lib/useSession';
import type { College, Lab } from '@/lib/useSession';
import type { Role } from '@/lib/assets';

interface ManagedUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  collegeId: number;
  collegeName: string | null;
  labId: number | null;
  labName: string | null;
  assignedLabs?: { id: number; name: string }[];
  assignedLabIds?: number[];
  isActive: boolean;
  keycloakLinked: boolean;
  lastLogin: string | null;
}

const ROLES: Role[] = ['admin', 'main_technician', 'technician'];
const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

export default function UsersPage() {
  const router = useRouter();
  const user = useSession();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create modal
  const [creating, setCreating] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    email: '',
    role: 'technician' as Role,
    collegeId: '',
    labId: '',
    password: '',
  });

  // Edit modal
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [editData, setEditData] = useState({
    role: 'technician' as Role,
    collegeId: '',
    labId: '',
    assignedLabIds: [] as number[],
    isActive: true,
  });

  // Reset password modal
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    (async () => {
      try {
        const [usersRes, collegesRes, labsRes] = await Promise.all([
          fetch('/api/users', { credentials: 'include' }),
          fetch('/api/colleges', { credentials: 'include' }),
          fetch('/api/labs', { credentials: 'include' }),
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data ?? []);
        }
        if (collegesRes.ok) {
          const data = await collegesRes.json();
          setColleges(data.data ?? data);
        }
        if (labsRes.ok) {
          const data = await labsRes.json();
          setLabs(data.data ?? data);
        }
      } catch {
        setError('Failed to load user data.');
      }
    })();
  }, [user]);

  const labsForCollege = useMemo(() => {
    const selected = editing ? editData.collegeId : createData.collegeId;
    return labs.filter((lab) => lab.collegeId === parseInt(selected, 10));
  }, [labs, createData.collegeId, editData.collegeId, editing]);

  if (!user) return null; // useSession is redirecting to /login
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Forbidden</h1>
          <p className="text-gray-600 mb-4">Only administrators can manage users.</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const showError = (message: string) => {
    setError(message);
    setNotice('');
  };
  const showNotice = (message: string) => {
    setNotice(message);
    setError('');
  };

  const run = async (url: string, method: string, body: unknown, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        showError(data.error || 'Request failed');
        return false;
      }
      showNotice(success);
      const usersRes = await fetch('/api/users', { credentials: 'include' });
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data ?? []);
      }
      return true;
    } catch {
      showError('Network error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const createUser = async () => {
    const ok = await run(
      '/api/users',
      'POST',
      createData,
      'User created.'
    );
    if (ok) {
      setCreating(false);
      setCreateData({ name: '', email: '', role: 'technician', collegeId: '', labId: '', password: '' });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const ok = await run(
      `/api/users/${editing.id}`,
      'PUT',
      {
        role: editData.role,
        collegeId: editData.collegeId,
        labId: editData.role === 'main_technician' ? null : editData.labId,
        isActive: editData.isActive,
      },
      'User updated.'
    );
    if (ok) {
      if (editData.role === 'main_technician') {
        await fetch(`/api/users/${editing.id}/labs`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labIds: editData.assignedLabIds }),
          credentials: 'include',
        });
        const usersRes = await fetch('/api/users', { credentials: 'include' });
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.data ?? []);
        }
      }
      setEditing(null);
    }
  };

  const handleResetPassword = async () => {
    if (!resetting) return;
    const ok = await run(
      `/api/users/${resetting.id}/password`,
      'PUT',
      { newPassword: resetPassword },
      'Password reset. The user must sign in again.'
    );
    if (ok) {
      setResetting(null);
      setResetPassword('');
    }
  };

  const toggleActive = async (target: ManagedUser) => {
    await run(
      `/api/users/${target.id}`,
      'PUT',
      { isActive: !target.isActive },
      target.isActive ? 'User disabled.' : 'User enabled.'
    );
  };

  const openEdit = async (target: ManagedUser) => {
    setEditing(target);
    let assignedLabIds: number[] = target.assignedLabIds ?? [];
    if (target.role === 'main_technician' && (!target.assignedLabIds || target.assignedLabIds.length === 0)) {
      try {
        const res = await fetch(`/api/users/${target.id}/labs`, { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          assignedLabIds = (json.data ?? []).map((l: any) => l.id);
        }
      } catch {
        // ignore
      }
    }
    setEditData({
      role: target.role,
      collegeId: String(target.collegeId),
      labId: target.labId ? String(target.labId) : '',
      assignedLabIds,
      isActive: target.isActive,
    });
  };

  const modalInput =
    'w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <AppHeader
          user={{ name: user.name, role: user.role, collegeId: user.collegeId }}
          colleges={colleges}
          selectedCollegeId="all"
          onCollegeChange={() => {}}
          title="User Management"
          subtitle="Create accounts, assign roles, colleges and labs, and control access"
        />

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {notice && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{notice}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 font-semibold text-gray-700">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Email</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Role</th>
                <th className="px-4 py-3 font-semibold text-gray-700">College</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Lab</th>
                <th className="px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-700">SSO</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{entry.name}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${ROLE_COLORS[entry.role]}`}>
                      {ROLE_LABELS[entry.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{entry.collegeName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {entry.role === 'main_technician' ? (
                      entry.assignedLabs && entry.assignedLabs.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {entry.assignedLabs.map((l) => (
                            <span key={l.id} className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded border border-blue-200">
                              {l.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">No assigned labs</span>
                      )
                    ) : (
                      entry.labName || '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                      entry.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                      {entry.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{entry.keycloakLinked ? 'Linked' : '—'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(entry)}
                      disabled={busy}
                      className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 rounded-md"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setResetting(entry); setResetPassword(''); }}
                      disabled={busy}
                      className="px-2.5 py-1 text-xs font-medium text-amber-600 hover:text-amber-800 rounded-md"
                    >
                      Reset PW
                    </button>
                    <button
                      onClick={() => toggleActive(entry)}
                      disabled={busy}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md ${
                        entry.isActive ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'
                      }`}
                    >
                      {entry.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No users yet. Create the first account below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <button
          onClick={() => { setCreating(true); setError(''); setNotice(''); }}
          disabled={busy}
          className="mt-4 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          + Create User
        </button>

        {/* Create modal */}
        {creating && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Create User</h2>
              <div className="space-y-4">
                <input
                  className={modalInput}
                  placeholder="Full name"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                />
                <input
                  className={modalInput}
                  type="email"
                  placeholder="Email address"
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                />
                <select
                  className={modalInput}
                  value={createData.role}
                  onChange={(e) => setCreateData({ ...createData, role: e.target.value as Role })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
                <select
                  className={modalInput}
                  value={createData.collegeId}
                  onChange={(e) => setCreateData({ ...createData, collegeId: e.target.value, labId: '' })}
                >
                  <option value="">Select college…</option>
                  {colleges.map((college) => (
                    <option key={college.id} value={college.id}>{college.name}</option>
                  ))}
                </select>
                {createData.role === 'technician' ? <select
                  className={modalInput}
                  value={createData.labId}
                  onChange={(e) => setCreateData({ ...createData, labId: e.target.value })}
                >
                  <option value="">No lab assignment</option>
                  {labsForCollege.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select> : <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">{createData.role === 'main_technician' ? 'Assign one or more labs after creating this head technician.' : 'Administrators are not tied to a lab.'}</p>}
                <input
                  className={modalInput}
                  type="password"
                  placeholder="Password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                />
                <p className="text-xs text-gray-500">{PASSWORD_HINT}</p>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setCreating(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={createUser}
                  disabled={busy}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Edit {editing.name}</h2>
              <p className="text-sm text-gray-500 mb-4">{editing.email}</p>
              <div className="space-y-4">
                <select
                  className={modalInput}
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value as Role })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select>
                <select
                  className={modalInput}
                  value={editData.collegeId}
                  onChange={(e) => setEditData({ ...editData, collegeId: e.target.value, labId: '' })}
                >
                  {colleges.map((college) => (
                    <option key={college.id} value={college.id}>{college.name}</option>
                  ))}
                </select>
                {editData.role === 'main_technician' ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Assigned Labs (Head Technician)
                    </label>
                    <div className="max-h-44 overflow-y-auto border border-gray-300 rounded-lg p-2.5 space-y-1 bg-white">
                      {labsForCollege.length === 0 ? (
                        <p className="text-xs text-gray-400">No labs in selected college</p>
                      ) : (
                        labsForCollege.map((lab) => {
                          const checked = editData.assignedLabIds.includes(lab.id);
                          return (
                            <label
                              key={lab.id}
                              className="flex items-center gap-2.5 text-sm text-gray-800 hover:bg-gray-50 p-1.5 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setEditData({
                                      ...editData,
                                      assignedLabIds: [...editData.assignedLabIds, lab.id],
                                    });
                                  } else {
                                    setEditData({
                                      ...editData,
                                      assignedLabIds: editData.assignedLabIds.filter((id) => id !== lab.id),
                                    });
                                  }
                                }}
                                className="h-4 w-4 accent-blue-600 rounded"
                              />
                              <span className="font-medium text-xs">{lab.name}</span>
                              <span className="text-[10px] text-gray-500 font-mono">({lab.code})</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <p className="text-xs text-gray-500">Head technicians can manage assets only in their assigned labs.</p>
                  </div>
                ) : editData.role === 'technician' ? (
                  <select
                    className={modalInput}
                    value={editData.labId}
                    onChange={(e) => setEditData({ ...editData, labId: e.target.value })}
                  >
                    <option value="">No lab assignment</option>
                    {labsForCollege.map((lab) => (
                      <option key={lab.id} value={lab.id}>{lab.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Administrators are not tied to a lab.</p>
                )}
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={editData.isActive}
                    onChange={(e) => setEditData({ ...editData, isActive: e.target.checked })}
                    className="h-4 w-4 accent-green-600"
                  />
                  Account active (disable to revoke access immediately)
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={busy}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset password modal */}
        {resetting && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Reset Password</h2>
              <p className="text-sm text-gray-500 mb-4">
                {resetting.name} ({resetting.email}) — all their sessions will be revoked.
              </p>
              <input
                className={modalInput}
                type="password"
                placeholder="New password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-2">{PASSWORD_HINT}</p>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setResetting(null)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={busy}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
