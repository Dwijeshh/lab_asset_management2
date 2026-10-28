'use client';

import { useState } from 'react';
import ModalDialog from '@/components/ModalDialog';

interface BorrowRequestModalProps {
  asset: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BorrowRequestModal({ asset, onClose, onSuccess }: BorrowRequestModalProps) {
  const [loanType, setLoanType] = useState('temporary');
  const [notes, setNotes] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/asset-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: asset.id,
          loanType,
          notes,
          ...(loanType === 'temporary' && expectedReturnDate && { expectedReturnDate }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalDialog title="Request asset" onClose={onClose}>
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><h2 className="section-title">Request asset</h2><p className="muted-copy mt-1 text-sm">Choose how your lab needs this asset.</p></div>
          <button type="button" onClick={onClose} aria-label="Close request" className="record-action">Close</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div role="alert" className="ui-alert">{error}</div>}
          <div className="border-b border-[var(--ui-line)] pb-4">
            <p className="font-semibold">{asset.name}</p>
            <p className="muted-copy mt-1 text-sm">Serial number: {asset.serialNumber || 'Not recorded'}</p>
          </div>
          <fieldset>
            <legend className="ui-label">Request type</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="request-option"><input type="radio" name="loanType" value="temporary" checked={loanType === 'temporary'} onChange={(e) => setLoanType(e.target.value)} />Temporary loan</label>
              <label className="request-option"><input type="radio" name="loanType" value="permanent" checked={loanType === 'permanent'} onChange={(e) => setLoanType(e.target.value)} />Permanent transfer</label>
            </div>
          </fieldset>
          {loanType === 'temporary' && (
            <div>
              <label htmlFor="expected-return" className="ui-label">Expected return date</label>
              <input id="expected-return" type="date" value={expectedReturnDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setExpectedReturnDate(e.target.value)} className="ui-field" />
              <p className="ui-hint mt-1">When you plan to return it. The approver can adjust this.</p>
            </div>
          )}
          <div>
            <label htmlFor="request-notes" className="ui-label">Reason or notes (optional)</label>
            <textarea id="request-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="ui-field" rows={3} placeholder="Why does your lab need this asset?" />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ui-line)] pt-4">
            <button type="button" onClick={onClose} className="ui-button ui-button-secondary">Cancel</button>
            <button type="submit" disabled={loading} className="ui-button ui-button-primary">{loading ? 'Submitting…' : 'Submit request'}</button>
          </div>
        </form>
      </div>
    </ModalDialog>
  );
}
