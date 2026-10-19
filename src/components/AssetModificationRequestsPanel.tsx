'use client';

import { useCallback, useEffect, useState } from 'react';

function renderProposedField(field: string, value: unknown, labels: Record<string, string>) {
  if (field === 'customFields' && value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).map(([key, customValue]) => <div key={`custom-${key}`} className="text-sm"><dt className="inline font-medium text-gray-700">{labels[key] || key}: </dt><dd className="inline text-gray-600">{String(customValue ?? '—')}</dd></div>);
  }
  const label = labels[field] || field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`);
  const formatted = value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—');
  return <div key={field} className="text-sm"><dt className="inline font-medium capitalize text-gray-700">{label}: </dt><dd className="inline text-gray-600">{formatted}</dd></div>;
}

export default function AssetModificationRequestsPanel({ userRole }: { userRole: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const canReview = userRole === 'admin' || userRole === 'main_technician';

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/asset-modification-requests');
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Could not load requests'); return; }
      setRequests(data.data || []);
      setError('');
    } catch { setError('Could not load requests. Check your connection and try again.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const review = async (id: number, action: 'approve' | 'reject') => {
    const reviewNote = window.prompt(`Optional note for this ${action === 'approve' ? 'approval' : 'rejection'}:`, '');
    if (reviewNote === null) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/asset-modification-requests/${id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewNote }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || `Could not ${action} request`); return; }
      await refresh();
    } catch { setError(`Could not ${action} request. Check your connection and try again.`); }
    finally { setBusyId(null); }
  };

  if (loading) return <div className="rounded-lg border bg-white p-6 text-center text-gray-500">Loading asset change requests…</div>;
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {requests.length === 0 ? <div className="rounded-lg border bg-white p-6 text-center text-gray-500">No asset change requests found.</div> : requests.map(({ request: item, requester, asset, fieldLabels }) => (
      <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h3 className="font-semibold text-gray-900">{asset?.name || item.assetName}</h3><p className="text-sm text-gray-500">Requested by {requester?.name || 'Unknown'} · {new Date(item.createdAt).toLocaleString()}</p></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${item.status === 'pending' ? 'bg-amber-100 text-amber-800' : item.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span>
        </div>
        <p className="mt-3 text-sm text-gray-700"><span className="font-medium">Reason:</span> {item.reason}</p>
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">{Object.entries(item.proposedChanges as Record<string, unknown>).map(([field, value]) => renderProposedField(field, value, fieldLabels || {}))}</dl>
        {item.reviewNote && <p className="mt-3 text-sm text-gray-600"><span className="font-medium">Review note:</span> {item.reviewNote}</p>}
        {canReview && item.status === 'pending' && <div className="mt-4 flex justify-end gap-2"><button disabled={busyId === item.id} onClick={() => void review(item.id, 'reject')} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50">Reject</button><button disabled={busyId === item.id} onClick={() => void review(item.id, 'approve')} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">Approve</button></div>}
      </article>
    ))}
  </div>;
}
