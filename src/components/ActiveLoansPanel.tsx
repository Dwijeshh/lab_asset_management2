'use client';

import { useState, useEffect } from 'react';

export default function ActiveLoansPanel({ userRole }: { userRole: string }) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLoans = async () => {
    try {
      const res = await fetch('/api/asset-loans');
      if (res.ok) {
        const data = await res.json();
        setLoans(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch loans:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans();
  }, []);

  const handleReturn = async (id: number) => {
    if (!confirm('Mark this asset as returned?')) return;

    try {
      const res = await fetch(`/api/asset-loans/${id}`, { method: 'PUT' });
      if (res.ok) {
        fetchLoans();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to return asset');
      }
    } catch (error) {
      console.error('Failed to return asset:', error);
    }
  };

  if (loading) return <div className="p-4 text-center text-gray-500">Loading loans...</div>;
  if (loans.length === 0) return <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg border border-gray-200">No active loans.</div>;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full text-left text-sm text-gray-600">
        <thead className="bg-gray-50 text-gray-700 uppercase font-semibold text-xs">
          <tr>
            <th className="px-4 py-3">Asset</th>
            <th className="px-4 py-3">Borrower</th>
            <th className="px-4 py-3">Lab</th>
            <th className="px-4 py-3">Loan Date</th>
            <th className="px-4 py-3">Expected Return</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loans.map(loan => (
            <tr key={loan.loan.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900">{loan.asset?.name}</div>
                <div className="text-xs">SN: {loan.asset?.serialNumber || 'N/A'}</div>
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">{loan.borrower?.name}</td>
              <td className="px-4 py-3">{loan.lab?.name || 'N/A'}</td>
              <td className="px-4 py-3 text-xs">{new Date(loan.loan.loanDate).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-xs">
                {loan.loan.loanType === 'permanent' ? (
                  <span className="text-gray-400">—</span>
                ) : loan.loan.expectedReturnDate ? (
                  <span className={
                    loan.loan.status === 'active' && new Date(loan.loan.expectedReturnDate) < new Date()
                      ? 'text-red-600 font-semibold'
                      : 'text-gray-700'
                  }>
                    {new Date(loan.loan.expectedReturnDate).toLocaleDateString()}
                    {loan.loan.status === 'active' && new Date(loan.loan.expectedReturnDate) < new Date() && ' (overdue)'}
                  </span>
                ) : (
                  <span className="text-gray-400">Not set</span>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 text-[10px] font-semibold rounded-full uppercase ${
                  loan.loan.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {loan.loan.status}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {loan.loan.status === 'active' && loan.loan.loanType === 'temporary' && (userRole === 'admin' || userRole === 'main_technician') && (
                  <button 
                    onClick={() => handleReturn(loan.loan.id)}
                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-xs font-medium transition-colors"
                  >
                    Mark Returned
                  </button>
                )}
                {loan.loan.loanType === 'permanent' && (
                  <span className="text-xs text-gray-400 italic">Permanent Transfer</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
