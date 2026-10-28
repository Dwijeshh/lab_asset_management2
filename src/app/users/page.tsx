'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AppHeader from '@/components/AppHeader';
import ModalDialog from '@/components/ModalDialog';
import UiIcon from '@/components/UiIcon';
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
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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
  const [editData, setEditData] = useState({ role: 'technician' as Role, collegeId: '', labId: '', isActive: true });

  // Reset password modal
  const [resetting, setResetting] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;
    (async () => {
      try {
        setLoadingUsers(true);
        const [usersRes, collegesRes, labsRes] = await Promise.all([
          fetch('/api/users', { credentials: 'include' }),
          fetch('/api/colleges', { credentials: 'include' }),
          fetch('/api/labs', { credentials: 'include' }),
        ]);
        if (!usersRes.ok || !collegesRes.ok || !labsRes.ok) throw new Error('Failed to load user data.');
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
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, [user]);

  const labsForCollege = useMemo(() => {
    const selected = editing ? editData.collegeId : createData.collegeId;
    return labs.filter((lab) => lab.collegeId === parseInt(selected, 10));
  }, [labs, createData.collegeId, editData.collegeId, editing]);
  const filteredUsers = useMemo(() => users.filter((entry) => {
    const query = search.trim().toLowerCase();
    return (roleFilter === 'all' || entry.role === roleFilter) && (!query || [entry.name, entry.email, entry.collegeName, entry.labName].some((value) => value?.toLowerCase().includes(query)));
  }), [users, search, roleFilter]);

  if (!user) return null; // useSession is redirecting to /login
  if (user.role !== 'admin') {
    return (
      <div className="campus-page min-h-screen">
        <main className="page-shell"><div className="surface-card mx-auto max-w-md p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Forbidden</h1>
          <p className="text-gray-600 mb-4">Only administrators can manage users.</p>
          <button
            onClick={() => router.push('/')}
            className="ui-button ui-button-primary"
          >
            Back to Dashboard
          </button>
        </div></main>
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
      editData,
      'User updated.'
    );
    if (ok) setEditing(null);
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

  const openEdit = (target: ManagedUser) => {
    setEditing(target);
    setEditData({
      role: target.role,
      collegeId: String(target.collegeId),
      labId: target.labId ? String(target.labId) : '',
      isActive: target.isActive,
    });
  };

  const modalInput =
    'ui-field';

  return (
    <div className="campus-page campus-page-users min-h-screen">
      <div className="campus-banner-pair"><span>MAHE · Manipal Academy of Higher Education</span><span>MIT · Manipal Institute of Technology</span></div>
      <main className="page-shell">
        <AppHeader
          user={{ name: user.name, role: user.role, collegeId: user.collegeId }}
          colleges={colleges}
          selectedCollegeId="all"
          onCollegeChange={() => {}}
          showCollegeSelector={false}
          title="User Management"
          subtitle="Create accounts, assign roles, colleges and labs, and control access"
        />

        <section aria-label="MAHE campus views" className="mb-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            <figure className="campus-gallery-photo relative h-32 overflow-hidden rounded-xl sm:h-60">
              <Image src="/mahe-administration.jpg" alt="MAHE Manipal administrative building" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover object-center" />
              <figcaption className="campus-gallery-caption">MAHE Manipal</figcaption>
            </figure>
            <figure className="campus-gallery-photo campus-gallery-photo-mit relative h-32 overflow-hidden rounded-xl sm:h-60">
              <Image src="/mit-manipal-user-photo.png" alt="Front entrance of Manipal Institute of Technology" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-contain object-center" />
              <figcaption className="campus-gallery-caption">MIT Manipal</figcaption>
            </figure>
            <figure className="campus-gallery-photo campus-gallery-photo-mcods relative h-32 overflow-hidden rounded-xl sm:h-60">
              <Image src="/mcods-manipal-user-photo.png" alt="Entrance of Manipal College of Dental Sciences" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-contain object-center" />
              <figcaption className="campus-gallery-caption">MCODS Manipal</figcaption>
            </figure>
            <figure className="campus-gallery-photo campus-gallery-photo-mcops relative h-32 overflow-hidden rounded-xl sm:h-60">
              <Image src="/mcops-manipal-user-photo.png" alt="Building of Manipal College of Pharmaceutical Sciences" fill sizes="(max-width: 640px) 50vw, 25vw" className="object-contain object-center" />
              <figcaption className="campus-gallery-caption">MCOPS Manipal</figcaption>
            </figure>
          </div>
          <p className="ui-hint mt-2 text-right">MAHE photo: <a className="underline" href="https://commons.wikimedia.org/wiki/File:MAHEMANIPALEDU.jpg" target="_blank" rel="noopener noreferrer">Lann the Clever</a> · CC BY-SA 4.0. MIT, MCODS, and MCOPS photos: user supplied.</p>
        </section>

        {error && (
          <div role="alert" className="ui-alert mb-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}
        {notice && (
          <div role="status" className="ui-success mb-4">
            <p className="text-green-800 text-sm">{notice}</p>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="section-title">Accounts</h2><p className="muted-copy mt-1 text-sm">{filteredUsers.length} of {users.length} users</p></div>
          <button onClick={() => { setCreating(true); setError(''); setNotice(''); }} disabled={busy} className="ui-button ui-button-primary"><UiIcon name="plus" className="h-4 w-4" /> Create user</button>
        </div>
        <div className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <div><label htmlFor="user-search" className="ui-label">Search users</label><input id="user-search" type="search" className="ui-field" placeholder="Name, email, college or lab" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div><label htmlFor="user-role-filter" className="ui-label">Role</label><select id="user-role-filter" className="ui-field" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="all">All roles</option>{ROLES.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></div>
        </div>
        {loadingUsers ? <div role="status" aria-label="Loading users" className="surface-card ui-loading"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton"/><div className="ui-skeleton w-3/4"/></div> : <div className="surface-card data-region" role="region" aria-label="User accounts table" tabIndex={0}>
          <table className="data-table user-table">
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
              {filteredUsers.map((entry) => (
                <tr key={entry.id} className="user-record-row border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900"><span className="user-cell-label">Name</span>{entry.name}</td>
                  <td className="px-4 py-3 text-gray-600"><span className="user-cell-label">Email</span><span className="min-w-0 break-all">{entry.email}</span></td>
                  <td className="px-4 py-3">
                    <span className="user-cell-label">Role</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${ROLE_COLORS[entry.role]}`}>
                      {ROLE_LABELS[entry.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600"><span className="user-cell-label">Institution</span>{entry.collegeName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600"><span className="user-cell-label">Lab</span>{entry.labName || '—'}</td>
                  <td className="px-4 py-3">
                    <span className="user-cell-label">Status</span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${
                      entry.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
                    }`}>
                      {entry.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500"><span className="user-cell-label">SSO</span>{entry.keycloakLinked ? 'Linked' : '—'}</td>
                  <td className="user-record-actions px-4 py-3 text-right">
                    <button
                      onClick={() => openEdit(entry)}
                      disabled={busy}
                      className="record-action"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { setResetting(entry); setResetPassword(''); }}
                      disabled={busy}
                      className="record-action"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => toggleActive(entry)}
                      disabled={busy}
                      className={`record-action ${entry.isActive ? 'record-action-danger' : ''}`}
                    >
                      {entry.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr className="user-empty-row">
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    {users.length === 0 ? 'No users yet. Create the first account.' : 'No users match these filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>}

        {/* Create modal */}
        {creating && (
          <ModalDialog title="Create user" onClose={() => setCreating(false)}>
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3"><h2 className="section-title">Create user</h2><button type="button" onClick={() => setCreating(false)} className="record-action">Close</button></div>
              {error && <div role="alert" className="ui-alert mb-4">{error}</div>}
              <div className="space-y-4">
                <div><label htmlFor="create-name" className="ui-label">Full name</label>
                <input
                  id="create-name"
                  className={modalInput}
                  placeholder="Full name"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                /></div>
                <div><label htmlFor="create-email" className="ui-label">Email address</label>
                <input
                  id="create-email"
                  className={modalInput}
                  type="email"
                  placeholder="Email address"
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                /></div>
                <div><label htmlFor="create-role" className="ui-label">Role</label>
                <select
                  id="create-role"
                  className={modalInput}
                  value={createData.role}
                  onChange={(e) => setCreateData({ ...createData, role: e.target.value as Role })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select></div>
                <div><label htmlFor="create-college" className="ui-label">Institution</label>
                <select
                  id="create-college"
                  className={modalInput}
                  value={createData.collegeId}
                  onChange={(e) => setCreateData({ ...createData, collegeId: e.target.value, labId: '' })}
                >
                  <option value="">Select college…</option>
                  {colleges.map((college) => (
                    <option key={college.id} value={college.id}>{college.name}</option>
                  ))}
                </select></div>
                <div><label htmlFor="create-lab" className="ui-label">Lab assignment</label>
                <select
                  id="create-lab"
                  className={modalInput}
                  value={createData.labId}
                  onChange={(e) => setCreateData({ ...createData, labId: e.target.value })}
                >
                  <option value="">No lab assignment</option>
                  {labsForCollege.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select></div>
                <div><label htmlFor="create-password" className="ui-label">Password</label>
                <input
                  id="create-password"
                  className={modalInput}
                  type="password"
                  placeholder="Password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  aria-describedby="create-password-hint"
                />
                <p id="create-password-hint" className="ui-hint mt-1">{PASSWORD_HINT}</p></div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setCreating(false)}
                  className="ui-button ui-button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={createUser}
                  disabled={busy}
                  className="ui-button ui-button-primary"
                >
                  Create user
                </button>
              </div>
            </div>
          </ModalDialog>
        )}

        {/* Edit modal */}
        {editing && (
          <ModalDialog title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><h2 className="section-title">Edit {editing.name}</h2><button type="button" onClick={() => setEditing(null)} className="record-action">Close</button></div>
              <p className="text-sm text-gray-500 mb-4">{editing.email}</p>
              {error && <div role="alert" className="ui-alert mb-4">{error}</div>}
              <div className="space-y-4">
                <div><label htmlFor="edit-role" className="ui-label">Role</label>
                <select
                  id="edit-role"
                  className={modalInput}
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value as Role })}
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </select></div>
                <div><label htmlFor="edit-college" className="ui-label">Institution</label>
                <select
                  id="edit-college"
                  className={modalInput}
                  value={editData.collegeId}
                  onChange={(e) => setEditData({ ...editData, collegeId: e.target.value, labId: '' })}
                >
                  {colleges.map((college) => (
                    <option key={college.id} value={college.id}>{college.name}</option>
                  ))}
                </select></div>
                <div><label htmlFor="edit-lab" className="ui-label">Lab assignment</label>
                <select
                  id="edit-lab"
                  className={modalInput}
                  value={editData.labId}
                  onChange={(e) => setEditData({ ...editData, labId: e.target.value })}
                >
                  <option value="">No lab assignment</option>
                  {labsForCollege.map((lab) => (
                    <option key={lab.id} value={lab.id}>{lab.name}</option>
                  ))}
                </select></div>
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
                  className="ui-button ui-button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={busy}
                  className="ui-button ui-button-primary"
                >
                  Save changes
                </button>
              </div>
            </div>
          </ModalDialog>
        )}

        {/* Reset password modal */}
        {resetting && (
          <ModalDialog title="Reset password" onClose={() => setResetting(null)}>
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3"><h2 className="section-title">Reset password</h2><button type="button" onClick={() => setResetting(null)} className="record-action">Close</button></div>
              <p className="text-sm text-gray-500 mb-4">
                {resetting.name} ({resetting.email}) — all their sessions will be revoked.
              </p>
              {error && <div role="alert" className="ui-alert mb-4">{error}</div>}
              <label htmlFor="reset-password" className="ui-label">New password</label>
              <input
                id="reset-password"
                className={modalInput}
                type="password"
                placeholder="New password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                aria-describedby="reset-password-hint"
              />
              <p id="reset-password-hint" className="ui-hint mt-2">{PASSWORD_HINT}</p>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setResetting(null)}
                  className="ui-button ui-button-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={busy}
                  className="ui-button ui-button-primary"
                >
                  Reset password
                </button>
              </div>
            </div>
          </ModalDialog>
        )}
      </main>
    </div>
  );
}
