'use client';

import { useEffect, useState, type FormEvent } from 'react';
import ModalDialog from '@/components/ModalDialog';
import { ASSET_CATEGORIES } from '@/lib/assets';

type Option = { name: string; category: string; model: string | null; available: number };
const categoryName = (value: string) => ASSET_CATEGORIES.find(category => category.value === value)?.label || value;

export default function DeviceRequestModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState(-1);
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [loanType, setLoanType] = useState<'temporary' | 'permanent'>('temporary');
  const [returnDate, setReturnDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/device-requests/options').then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load available devices.');
      if (active) setOptions(result.data || []);
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load available devices.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const chosen = options[selected];
  const visible = options.map((option, index) => ({ option, index })).filter(({ option }) =>
    `${option.name} ${categoryName(option.category)} ${option.model || ''}`.toLowerCase().includes(search.toLowerCase()));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!chosen) { setError('Choose a device first.'); return; }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > Math.min(chosen.available, 20)) {
      setError(`Choose a quantity between 1 and ${Math.min(chosen.available, 20)}.`); return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/device-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetName: chosen.name, category: chosen.category, model: chosen.model,
          quantity, loanType, expectedReturnDate: loanType === 'temporary' ? returnDate || null : null, notes }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit the request.');
      onSuccess();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit the request.'); }
    finally { setSaving(false); }
  };

  return <ModalDialog title="Request devices" onClose={onClose}>
    <div className="p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div><h2 className="section-title">Request devices</h2><p className="muted-copy mt-1 text-sm">Choose a device type and quantity. Your institution’s main technician will assign available units from a lab.</p></div>
        <button type="button" className="record-action" onClick={onClose} aria-label="Close device request">Close</button>
      </div>
      {error && <div role="alert" className="ui-alert mb-4">{error}</div>}
      <form onSubmit={submit} className="space-y-5">
        <div><label htmlFor="device-search" className="ui-label">Find a device</label>
          <input id="device-search" className="ui-field" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, category or model" /></div>
        {loading ? <div role="status" className="ui-loading">Loading available devices…</div> : options.length === 0 ?
          <div className="ui-empty surface-card"><h3>No devices available</h3><p>There are no requestable units in other labs of your institution right now.</p></div> :
          <fieldset><legend className="ui-label">Device type</legend><div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-[var(--ui-line)] p-2">
            {visible.length === 0 ? <p className="muted-copy p-2 text-sm">No matching devices.</p> : visible.map(({ option, index }) =>
              <label key={`${option.name}-${option.category}-${option.model}-${index}`} className="request-option flex cursor-pointer items-start gap-3">
                <input type="radio" name="device" checked={selected === index} onChange={() => { setSelected(index); setQuantity(1); }} />
                <span className="min-w-0"><strong className="block">{option.name}</strong><span className="muted-copy text-sm">{categoryName(option.category)}{option.model ? ` · ${option.model}` : ''} · {option.available} available</span></span>
              </label>)}</div></fieldset>}
        {chosen && <div><label htmlFor="device-quantity" className="ui-label">Quantity</label><input id="device-quantity" className="ui-field" type="number" min={1} max={Math.min(chosen.available, 20)} value={quantity} onChange={event => setQuantity(Number(event.target.value))} required /><p className="ui-hint mt-1">Up to {Math.min(chosen.available, 20)} currently available across other labs.</p></div>}
        <fieldset><legend className="ui-label">Request type</legend><div className="grid gap-2 sm:grid-cols-2">
          <label className="request-option"><input type="radio" name="loanType" checked={loanType === 'temporary'} onChange={() => setLoanType('temporary')} />Temporary loan</label>
          <label className="request-option"><input type="radio" name="loanType" checked={loanType === 'permanent'} onChange={() => setLoanType('permanent')} />Permanent transfer</label>
        </div></fieldset>
        {loanType === 'temporary' && <div><label htmlFor="device-return-date" className="ui-label">Expected return date (optional)</label><input id="device-return-date" className="ui-field" type="date" min={new Date().toISOString().slice(0, 10)} value={returnDate} onChange={event => setReturnDate(event.target.value)} /><p className="ui-hint mt-1">The approver can adjust this date.</p></div>}
        <div><label htmlFor="device-notes" className="ui-label">Reason or notes (optional)</label><textarea id="device-notes" className="ui-field" rows={3} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Tell the main technician how these devices will be used" /></div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--ui-line)] pt-4"><button type="button" onClick={onClose} className="ui-button ui-button-secondary">Cancel</button><button type="submit" disabled={saving || loading || !chosen} className="ui-button ui-button-primary">{saving ? 'Submitting…' : 'Submit request'}</button></div>
      </form>
    </div>
  </ModalDialog>;
}
