'use client';

import { useState, useEffect } from 'react';

export default function ActiveLoansPanel({ userRole, collegeId }: { userRole: string; collegeId: string }) {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchLoans = async () => {
    try {
      const query = userRole === 'admin' && collegeId !== 'all' ? `?collegeId=${encodeURIComponent(collegeId)}` : '';
      const res = await fetch(`/api/asset-loans${query}`);
      if (!res.ok) throw new Error('Unable to load loans.');
      const data = await res.json();
      setLoans(data.data || []);
      setError('');
    } catch (error) {
      console.error('Failed to fetch loans:', error);
      setError('Loans could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => { await fetchLoans(); };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collegeId, userRole]);

  const handleReturn = async (id: number) => {
    if (!confirm('Mark this asset as returned?')) return;
    setActionError('');
    try {
      const res = await fetch(`/api/asset-loans/${id}`, { method: 'PUT' });
      if (res.ok) {
        fetchLoans();
      } else {
        const data = await res.json();
        setActionError(data.error || 'Unable to mark this asset returned. Please try again.');
      }
    } catch (error) {
      console.error('Failed to return asset:', error);
      setActionError('Unable to mark this asset returned. Check your connection and try again.');
    }
  };

  if (loading) return <div role="status" className="surface-card ui-loading" aria-label="Loading loans"><div className="ui-skeleton w-1/3"/><div className="ui-skeleton"/><div className="ui-skeleton w-3/4"/></div>;
  if (error) return <div role="alert" className="ui-alert">{error} <button type="button" onClick={() => { setLoading(true); setError(''); fetchLoans(); }} className="ml-2 underline font-semibold">Retry</button></div>;
  if (loans.length === 0) return <div className="surface-card ui-empty"><h3>No active loans</h3><p>Active loans for this institution will appear here.</p></div>;

  return (
    <>
    {actionError && <div role="alert" className="ui-alert mb-4">{actionError}</div>}
    <div className="surface-card data-region" role="region" aria-label="Loans table" tabIndex={0}>
      <table className="data-table responsive-record-table min-w-[950px]">
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
                <span className="record-cell-label">Asset</span>
                <div className="font-medium text-gray-900">{loan.asset?.name}</div>
                <div className="text-xs">SN: {loan.asset?.serialNumber || 'N/A'}</div>
              </td>
              <td className="px-4 py-3 font-medium text-gray-900"><span className="record-cell-label">Borrower</span>{loan.borrower?.name}</td>
              <td className="px-4 py-3"><span className="record-cell-label">Lab</span>{loan.lab?.name || 'N/A'}</td>
              <td className="px-4 py-3 text-xs"><span className="record-cell-label">Loan date</span>{new Date(loan.loan.loanDate).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-xs">
                <span className="record-cell-label">Expected return</span>
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
                <span className="record-cell-label">Status</span>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full uppercase ${
                  loan.loan.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {loan.loan.status}
                </span>
              </td>
              <td className="record-row-actions px-4 py-3 text-right">
                <span className="record-cell-label">Actions</span>
                {loan.loan.status === 'active' && loan.loan.loanType === 'temporary' && (userRole === 'admin' || userRole === 'main_technician') && (
                  <button 
                    onClick={() => handleReturn(loan.loan.id)}
                    className="record-action"
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
    </>
  );
}
