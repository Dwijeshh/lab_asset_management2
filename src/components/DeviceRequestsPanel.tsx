'use client';

import { useCallback, useEffect, useState } from 'react';
import ModalDialog from '@/components/ModalDialog';
import { ASSET_CATEGORIES } from '@/lib/assets';

type DeviceRequestRow = {
  request: { id: number; assetName: string; category: string; model: string | null; quantity: number; loanType: 'temporary' | 'permanent'; expectedReturnDate: string | null; notes: string | null; status: string; createdAt: string };
  requester: { name: string; email: string };
  destinationLab: { name: string; code: string };
  assignedAssets: { assetId: number; serialNumber: string | null }[];
};
type Candidate = { id: number; serialNumber: string | null; location: string | null; labId: number; labName: string; labCode: string };
const categoryName = (value: string) => ASSET_CATEGORIES.find(category => category.value === value)?.label || value;

export default function DeviceRequestsPanel({ userRole, collegeId }: { userRole: string; collegeId: string }) {
  const [rows, setRows] = useState<DeviceRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<DeviceRequestRow | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [returnDate, setReturnDate] = useState('');
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const canReview = userRole === 'admin' || userRole === 'main_technician';

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const query = userRole === 'admin' && collegeId !== 'all' ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
      const response = await fetch(`/api/device-requests${query}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load device requests.');
      setRows(result.data || []);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load device requests.'); }
    finally { setLoading(false); }
  }, [collegeId, userRole]);

  useEffect(() => { const load = async () => { await reload(); }; void load(); }, [reload]);

  const openAssignment = async (row: DeviceRequestRow) => {
    setActing(row); setSelected([]); setActionError(''); setCandidates([]);
    setReturnDate(row.request.expectedReturnDate?.slice(0, 10) || '');
    setCandidateLoading(true);
    try {
      const response = await fetch(`/api/device-requests/${row.request.id}/candidates`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load available units.');
      setCandidates(result.data || []);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Could not load available units.'); }
    finally { setCandidateLoading(false); }
  };

  const decide = async (action: 'approve' | 'reject') => {
    if (!acting) return;
    if (action === 'approve' && selected.length !== acting.request.quantity) {
      setActionError(`Select exactly ${acting.request.quantity} units.`); return;
    }
    if (action === 'reject' && !window.confirm('Reject this device request?')) return;
    setSaving(true); setActionError('');
    try {
      const response = await fetch(`/api/device-requests/${acting.request.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, assetIds: action === 'approve' ? selected : [], expectedReturnDate: action === 'approve' && acting.request.loanType === 'temporary' ? returnDate || null : null }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not process the request.');
      setActing(null); void reload();
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : 'Could not process the request.'); }
    finally { setSaving(false); }
  };

  const byLab = Object.entries(candidates.reduce<Record<string, Candidate[]>>((groups, candidate) => {
    const key = `${candidate.labName} (${candidate.labCode})`;
    (groups[key] ||= []).push(candidate);
    return groups;
  }, {}));

  return <section className="mb-6" aria-labelledby="device-requests-heading">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 id="device-requests-heading" className="section-title">Device quantity requests</h2><p className="muted-copy text-sm">{canReview ? 'Assign available units from your institution’s labs.' : 'Track requests for device types and quantities.'}</p></div><button type="button" className="ui-button ui-button-secondary" onClick={() => void reload()}>Refresh</button></div>
    {loading ? <div role="status" className="surface-card ui-loading" aria-label="Loading device requests"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton"/></div> : error ? <div role="alert" className="ui-alert">{error} <button type="button" className="underline" onClick={() => void reload()}>Retry</button></div> : rows.length === 0 ? <div className="surface-card ui-empty"><h3>No device quantity requests</h3><p>New requests will appear here.</p></div> :
      <div className="grid gap-3">{rows.map(row => <article key={row.request.id} className="surface-card p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-lg">{row.request.quantity} × {row.request.assetName}</h3><p className="muted-copy text-sm">{categoryName(row.request.category)}{row.request.model ? ` · ${row.request.model}` : ''} · {row.request.loanType === 'temporary' ? 'Temporary loan' : 'Permanent transfer'}</p></div><span className="rounded-full border border-[var(--ui-line)] px-3 py-1 text-sm font-medium capitalize">{row.request.status}</span></div>
        <p className="mt-3 text-sm">Requested by <strong>{row.requester.name}</strong> for <strong>{row.destinationLab.name}</strong> ({row.destinationLab.code})</p>
        {row.request.expectedReturnDate && <p className="muted-copy mt-1 text-sm">Expected return: {new Date(row.request.expectedReturnDate).toLocaleDateString()}</p>}
        {row.request.notes && <p className="muted-copy mt-1 text-sm">Notes: {row.request.notes}</p>}
        {row.assignedAssets.length > 0 && <p className="muted-copy mt-2 text-sm">Assigned units: {row.assignedAssets.map(asset => asset.serialNumber || `#${asset.assetId}`).join(', ')}</p>}
        {canReview && row.request.status === 'pending' && <button type="button" onClick={() => void openAssignment(row)} className="ui-button ui-button-primary mt-4">Assign devices</button>}
      </article>)}</div>}
    {acting && <ModalDialog title="Assign devices" onClose={() => setActing(null)}><div className="p-5 sm:p-6"><div className="mb-4 flex items-start justify-between gap-2"><div><h2 className="section-title">Assign {acting.request.quantity} × {acting.request.assetName}</h2><p className="muted-copy mt-1 text-sm">Choose exact available units by source lab for {acting.destinationLab.name}.</p></div><button type="button" className="record-action" onClick={() => setActing(null)}>Close</button></div>
      {actionError && <div role="alert" className="ui-alert mb-4">{actionError}</div>}
      {candidateLoading ? <div role="status" className="ui-loading">Loading available units…</div> : byLab.length === 0 ? <div className="ui-empty surface-card"><h3>No matching units available</h3><p>Inventory may have changed since this request was submitted.</p></div> :
        <div className="max-h-64 space-y-4 overflow-y-auto"><p className="text-sm font-medium" aria-live="polite">{selected.length} of {acting.request.quantity} selected</p>{byLab.map(([lab, units]) => <fieldset key={lab} className="rounded-xl border border-[var(--ui-line)] p-3"><legend className="px-1 font-semibold">{lab} · {units.length} available</legend><div className="grid gap-2">{units.map(unit => <label key={unit.id} className="request-option flex cursor-pointer items-center gap-2"><input type="checkbox" checked={selected.includes(unit.id)} disabled={!selected.includes(unit.id) && selected.length >= acting.request.quantity} onChange={() => setSelected(current => current.includes(unit.id) ? current.filter(id => id !== unit.id) : [...current, unit.id])} /><span>{unit.serialNumber || `Asset #${unit.id}`}{unit.location ? ` · ${unit.location}` : ''}</span></label>)}</div></fieldset>)}</div>}
      {acting.request.loanType === 'temporary' && <div className="mt-4"><label className="ui-label" htmlFor="assignment-return">Expected return date (optional)</label><input id="assignment-return" type="date" min={new Date().toISOString().slice(0, 10)} value={returnDate} onChange={event => setReturnDate(event.target.value)} className="ui-field" /></div>}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--ui-line)] pt-4"><button type="button" className="ui-button ui-button-secondary" onClick={() => void decide('reject')} disabled={saving}>Reject request</button><button type="button" className="ui-button ui-button-primary" onClick={() => void decide('approve')} disabled={saving || candidateLoading || selected.length !== acting.request.quantity}>{saving ? 'Saving…' : 'Approve and assign'}</button></div>
    </div></ModalDialog>}
  </section>;
}
