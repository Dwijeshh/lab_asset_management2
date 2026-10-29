'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import CampusBannerLabel from '@/components/CampusBannerLabel';
import { institutionBanner } from '@/lib/institutionBanner';
import { useSession, type College } from '@/lib/useSession';

type LogRow = {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  changes: string | null;
  collegeId: number | null;
  relatedCollegeId: number | null;
  createdAt: string;
  actor: { id: number | null; name: string | null; email: string | null } | null;
};

const actionOptions = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'];
const recordOptions = [
  ['asset', 'Asset'], ['asset_request', 'Asset request'], ['device_request', 'Device request'],
  ['asset_loan', 'Loan'], ['user', 'User'], ['lab', 'Lab'],
] as const;
const recordLabel = (value: string) => recordOptions.find(([key]) => key === value)?.[1] || value;
const actionTone = (value: string) => value === 'APPROVE' || value === 'CREATE'
  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
  : value === 'REJECT' || value === 'DELETE'
    ? 'bg-red-50 text-red-800 border-red-200'
    : 'bg-stone-100 text-stone-800 border-stone-200';

function prettyChanges(changes: string | null): string {
  if (!changes) return 'No additional details recorded.';
  try { return JSON.stringify(JSON.parse(changes), null, 2); }
  catch { return changes; }
}

export default function ActivityLogPage() {
  const user = useSession();
  const router = useRouter();
  const [colleges, setColleges] = useState<College[]>([]);
  const [selectedCollegeId, setSelectedCollegeId] = useState('all');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const limit = 25;
  const permitted = user?.role === 'admin' || user?.role === 'main_technician';

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'main_technician') {
      router.replace('/');
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/colleges');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load institutions.');
        if (active) setColleges(result.data || []);
      } catch { /* The log remains usable with institution IDs if names cannot load. */ }
    };
    void load();
    return () => { active = false; };
  }, [user, router]);

  useEffect(() => {
    if (!user || !permitted) return;
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (user.role === 'admin' && selectedCollegeId !== 'all') params.set('collegeId', selectedCollegeId);
        if (action) params.set('action', action);
        if (entityType) params.set('entityType', entityType);
        const response = await fetch(`/api/audit-logs?${params}`, { signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Could not load activity.');
        setRows(result.data || []);
        setTotal(result.pagination?.total ?? 0);
        setError('');
      } catch (reason) {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Could not load activity.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [user, permitted, selectedCollegeId, action, entityType, page, refresh]);

  if (!user || !permitted) return <div className="campus-page min-h-screen"><main className="page-shell"><p role="status" className="surface-card mx-auto max-w-md p-8 text-center muted-copy">Loading activity log…</p></main></div>;

  const currentCollege = colleges.find(college => college.id.toString() === selectedCollegeId);
  const banner = institutionBanner(currentCollege, user.role === 'admin' && selectedCollegeId === 'all');
  const collegeName = (id: number | null) => id === null ? 'Institution not recorded' : colleges.find(college => college.id === id)?.name || `Institution #${id}`;
  const chooseCollege = (id: string) => { setSelectedCollegeId(id); setPage(1); setLoading(true); };
  const chooseAction = (value: string) => { setAction(value); setPage(1); setLoading(true); };
  const chooseRecord = (value: string) => { setEntityType(value); setPage(1); setLoading(true); };

  return <div className="campus-page min-h-screen" data-institution={banner}>
    <CampusBannerLabel institution={banner} name={currentCollege?.name} />
    <main className="page-shell">
      <AppHeader user={user} colleges={colleges} selectedCollegeId={user.role === 'admin' ? selectedCollegeId : String(user.collegeId)} onCollegeChange={chooseCollege} backLink={{ label: 'Back to Main Dashboard', href: '/' }} title="Activity log" subtitle={user.role === 'admin' ? 'Changes and approvals across MAHE institutions' : 'Changes and approvals in your institution'} />

      <section aria-labelledby="activity-heading">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 id="activity-heading" className="section-title">Recorded activity</h2><p className="muted-copy mt-1 text-sm">{user.role === 'admin' && selectedCollegeId === 'all' ? 'All MAHE institutions' : user.role === 'admin' ? currentCollege?.name || 'Selected institution' : collegeName(user.collegeId)} · {total} {total === 1 ? 'entry' : 'entries'}</p></div><button type="button" className="ui-button ui-button-secondary" onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>Refresh</button></div>
        <div className="surface-card mb-4 grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <div><label htmlFor="log-action" className="ui-label">Action</label><select id="log-action" className="ui-field" value={action} onChange={event => chooseAction(event.target.value)}><option value="">All actions</option>{actionOptions.map(option => <option key={option} value={option}>{option.charAt(0) + option.slice(1).toLowerCase()}</option>)}</select></div>
          <div><label htmlFor="log-record" className="ui-label">Record type</label><select id="log-record" className="ui-field" value={entityType} onChange={event => chooseRecord(event.target.value)}><option value="">All records</option>{recordOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        </div>

        {loading ? <div role="status" aria-label="Loading activity" className="surface-card ui-loading"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton"/><div className="ui-skeleton w-3/4"/></div> : error ?
          <div role="alert" className="ui-alert">{error} <button type="button" className="font-semibold underline" onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>Retry</button></div> : rows.length === 0 ?
          <div className="surface-card ui-empty"><h3>No activity matches this view</h3><p>Try another institution, action, or record type.</p></div> :
          <div className="surface-card data-region" role="region" aria-label="Activity log table" tabIndex={0}>
            <table className="data-table responsive-record-table"><caption className="sr-only">Change and approval history</caption><thead><tr><th className="px-4 py-3">When</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Staff member</th><th className="px-4 py-3">Institution</th><th className="px-4 py-3">Details</th></tr></thead>
              <tbody>{rows.map(row => <tr key={row.id}>
                <td className="px-4 py-3"><span className="record-cell-label">When</span><time dateTime={row.createdAt} className="whitespace-nowrap tabular-nums">{new Date(row.createdAt).toLocaleString()}</time></td>
                <td className="px-4 py-3"><span className="record-cell-label">Action</span><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${actionTone(row.action)}`}>{row.action.charAt(0) + row.action.slice(1).toLowerCase()}</span></td>
                <td className="px-4 py-3"><span className="record-cell-label">Record</span><span>{recordLabel(row.entityType)} <span className="muted-copy">#{row.entityId}</span></span></td>
                <td className="px-4 py-3"><span className="record-cell-label">Staff</span><span className="min-w-0 break-words">{row.actor?.name || 'Unknown staff member'}{row.actor?.email && <span className="muted-copy block text-xs">{row.actor.email}</span>}</span></td>
                <td className="px-4 py-3"><span className="record-cell-label">Institution</span><span className="min-w-0 break-words">{collegeName(row.collegeId)}{row.relatedCollegeId && row.relatedCollegeId !== row.collegeId ? <span className="block text-xs muted-copy">Also {collegeName(row.relatedCollegeId)}</span> : null}</span></td>
                <td className="px-4 py-3"><span className="record-cell-label">Details</span><details className="min-w-0"><summary className="cursor-pointer font-semibold text-[var(--ui-primary)]">View changes</summary><pre className="mt-2 max-h-48 max-w-[28rem] overflow-auto rounded-lg bg-[var(--ui-canvas)] p-3 text-xs whitespace-pre-wrap break-words">{prettyChanges(row.changes)}</pre></details></td>
              </tr>)}</tbody>
            </table>
          </div>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm muted-copy"><p aria-live="polite">{total === 0 ? 'No entries' : `Showing ${Math.min((page - 1) * limit + 1, total)}–${Math.min(page * limit, total)} of ${total}`}</p><div className="flex gap-2"><button type="button" className="ui-button ui-button-secondary" disabled={page <= 1 || loading} onClick={() => { setPage(value => value - 1); setLoading(true); }}>Previous</button><button type="button" className="ui-button ui-button-secondary" disabled={page * limit >= total || loading} onClick={() => { setPage(value => value + 1); setLoading(true); }}>Next</button></div></div>
      </section>
    </main>
  </div>;
}
