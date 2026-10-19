'use client';

import { useEffect, useState } from 'react';
import { ASSET_CATEGORIES, STATUSES } from '@/lib/assets';

const fields = ['name', 'category', 'manufacturer', 'model', 'serialNumber', 'location', 'status', 'purchaseDate', 'warrantyExpiry', 'notes'] as const;
type Field = typeof fields[number];
const labels: Record<Field, string> = {
  name: 'Name', category: 'Category', manufacturer: 'Manufacturer', model: 'Model',
  serialNumber: 'Serial number', location: 'Location', status: 'Status',
  purchaseDate: 'Purchase date', warrantyExpiry: 'Warranty expiry', notes: 'Notes',
};

function displayValue(value: unknown, field: Field): string {
  if (value === null || value === undefined) return '';
  if ((field === 'purchaseDate' || field === 'warrantyExpiry') && value) return new Date(String(value)).toISOString().slice(0, 10);
  return String(value);
}

export default function ProposeAssetModificationModal({ asset, onClose, onSuccess }: {
  asset: any;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<Record<Field, string>>(() => {
    const initial = {} as Record<Field, string>;
    for (const field of fields) initial[field] = displayValue(asset[field], field);
    return initial;
  });
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, unknown>>(asset.customFields || {});
  useEffect(() => {
    if (!asset.assetTypeId || !asset.collegeId) return;
    fetch(`/api/asset-types?collegeId=${asset.collegeId}`).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      setDefinitions(data.data?.find((type: any) => type.id === asset.assetTypeId)?.fields || []);
    }).catch(() => {});
  }, [asset.assetTypeId, asset.collegeId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const proposedChanges: Record<string, unknown> = {};
    for (const field of fields) {
      const before = displayValue(asset[field], field);
      if (values[field] !== before) proposedChanges[field] = values[field] === '' ? null : values[field];
    }
    if (JSON.stringify(customValues) !== JSON.stringify(asset.customFields || {})) proposedChanges.customFields = customValues;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/asset-modification-requests', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, proposedChanges, reason }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Could not submit the request'); return; }
      onSuccess();
    } catch {
      setError('Could not submit the request. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold text-gray-900">Suggest asset changes</h2><p className="mt-1 text-sm text-gray-600">{asset.name}</p></div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Close">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((field) => <label key={field} className="block text-sm font-medium text-gray-700">
              {labels[field]}
              {field === 'category' ? <select className={inputClass} value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })}>{ASSET_CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                : field === 'status' ? <select className={inputClass} value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })}>{STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                  : field === 'notes' ? <textarea className={inputClass} rows={2} value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />
                    : <input className={inputClass} type={field === 'purchaseDate' || field === 'warrantyExpiry' ? 'date' : 'text'} value={values[field]} onChange={(e) => setValues({ ...values, [field]: e.target.value })} />}
            </label>)}
          </div>
          {definitions.map((definition) => <label key={definition.id} className="block text-sm font-medium text-gray-700">{definition.label}
            {definition.type === 'select' ? <select className={inputClass} value={String(customValues[definition.fieldKey] ?? '')} onChange={(e) => setCustomValues({ ...customValues, [definition.fieldKey]: e.target.value })}><option value="">Select…</option>{(definition.options || []).map((option: string) => <option key={option}>{option}</option>)}</select>
              : definition.type === 'boolean' ? <select className={inputClass} value={customValues[definition.fieldKey] === undefined ? '' : String(customValues[definition.fieldKey])} onChange={(e) => setCustomValues({ ...customValues, [definition.fieldKey]: e.target.value === '' ? undefined : e.target.value === 'true' })}><option value="">Select…</option><option value="true">Yes</option><option value="false">No</option></select>
                : <input className={inputClass} type={definition.type === 'number' ? 'number' : definition.type === 'date' ? 'date' : 'text'} value={String(customValues[definition.fieldKey] ?? '')} onChange={(e) => setCustomValues({ ...customValues, [definition.fieldKey]: definition.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value })} />}
          </label>)}
          <label className="block text-sm font-medium text-gray-700">Reason for the change *<textarea required maxLength={2000} className={`${inputClass} mt-1`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={loading} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? 'Submitting…' : 'Submit request'}</button></div>
        </form>
      </div>
    </div>
  );
}
