'use client';

import { useState, useEffect } from 'react';

export default function PendingRequestsPanel({ userRole, collegeId }: { userRole: string; collegeId: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchRequests = async () => {
    try {
      const query = userRole === 'admin' && collegeId !== 'all' ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
      const res = await fetch(`/api/asset-requests${query}`);
      if (!res.ok) throw new Error('Unable to load borrow requests.');
      const data = await res.json();
      setRequests(data.data || []);
      setError('');
    } catch (error) {
      console.error('Failed to fetch requests:', error);
      setError('Borrow requests could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => { await fetchRequests(); };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId, userRole]);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;
    setActionError('');
    try {
      const res = await fetch(`/api/asset-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchRequests();
      } else {
        const data = await res.json();
        setActionError(data.error || `Unable to ${action} this request. Please try again.`);
      }
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
      setActionError(`Unable to ${action} this request. Check your connection and try again.`);
    }
  };

  if (loading) return <div role="status" className="surface-card ui-loading" aria-label="Loading borrow requests"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton"/><div className="ui-skeleton w-3/4"/></div>;
  if (error) return <div role="alert" className="ui-alert">{error} <button type="button" onClick={() => { setLoading(true); setError(''); fetchRequests(); }} className="ml-2 underline font-semibold">Retry</button></div>;
  if (requests.length === 0) return <div className="surface-card ui-empty"><h3>No borrow requests</h3><p>Requests for this institution will appear here.</p></div>;

  return (
    <>
    {actionError && <div role="alert" className="ui-alert mb-4">{actionError}</div>}
    <div className="surface-card data-region" role="region" aria-label="Borrow requests table" tabIndex={0}>
      <table className="data-table responsive-record-table min-w-[700px]">
        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs">
          <tr>
            <th className="px-4 py-3">Asset</th>
            <th className="px-4 py-3">Requester</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {requests.map(req => (
            <tr key={req.request.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <span className="record-cell-label">Asset</span>
                <div className="font-medium text-gray-900">{req.asset?.name}</div>
                <div className="text-xs">SN: {req.asset?.serialNumber || 'N/A'}</div>
              </td>
              <td className="px-4 py-3">
                <span className="record-cell-label">Requester</span>
                <div className="font-medium text-gray-900">{req.requester?.name}</div>
                <div className="text-xs">{req.requester?.email}</div>
              </td>
              <td className="px-4 py-3">
                <span className="record-cell-label">Type</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${
                  req.request.loanType === 'permanent' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {req.request.loanType}
                </span>
                {req.request.loanType === 'temporary' && req.request.expectedReturnDate && (
                  <div className="text-xs text-gray-500 mt-1">
                    until {new Date(req.request.expectedReturnDate).toLocaleDateString()}
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className="record-cell-label">Status</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${
                  req.request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                  req.request.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {req.request.status}
                </span>
              </td>
              <td className="record-row-actions px-4 py-3 text-right space-x-2">
                <span className="record-cell-label">Actions</span>
                {req.request.status === 'pending' && (userRole === 'admin' || userRole === 'main_technician') && (
                  <>
                    <button 
                      onClick={() => handleAction(req.request.id, 'approve')}
                      className="record-action"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleAction(req.request.id, 'reject')}
                      className="record-action record-action-danger"
                    >
                      Reject
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
