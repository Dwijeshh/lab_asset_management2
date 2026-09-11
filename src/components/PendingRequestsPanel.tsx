'use client';

import { useState, useEffect } from 'react';

export default function PendingRequestsPanel({ userRole }: { userRole: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/asset-requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;

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
        alert(data.error || `Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Failed to ${action} request:`, error);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500">Loading requests...</div>;
  if (requests.length === 0) return <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">No requests found.</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-left text-sm text-gray-600">
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
                <div className="font-medium text-gray-900">{req.asset?.name}</div>
                <div className="text-xs">SN: {req.asset?.serialNumber || 'N/A'}</div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{req.requester?.name}</div>
                <div className="text-xs">{req.requester?.email}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 text-[10px] font-semibold rounded-full uppercase ${
                  req.request.loanType === 'permanent' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {req.request.loanType}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 text-[10px] font-semibold rounded-full uppercase ${
                  req.request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                  req.request.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {req.request.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right space-x-2">
                {req.request.status === 'pending' && (userRole === 'admin' || userRole === 'main_technician') && (
                  <>
                    <button 
                      onClick={() => handleAction(req.request.id, 'approve')}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium transition-colors"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleAction(req.request.id, 'reject')}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition-colors"
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
  );
}
