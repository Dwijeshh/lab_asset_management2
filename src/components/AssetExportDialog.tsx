'use client';

import { useState } from 'react';
import ModalDialog from '@/components/ModalDialog';
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, type ExportColumn } from '@/lib/asset-export';

type Format = 'pdf' | 'docx' | 'csv' | 'zip';

export default function AssetExportDialog({
  onClose, filters, scope, count,
}: {
  onClose: () => void;
  filters: { collegeId?: string; labId?: string; search?: string; status?: string; category?: string };
  scope: string;
  count: number;
}) {
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_EXPORT_COLUMNS);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState('');

  const urlFor = (format: Format | 'print') => {
    const params = new URLSearchParams({ format, columns: columns.join(',') });
    for (const [key, value] of Object.entries(filters)) if (value && value !== 'all') params.set(key, value);
    return `/api/assets/export?${params}`;
  };

  const toggle = (key: ExportColumn) => {
    setColumns(previous => previous.includes(key) ? previous.filter(value => value !== key) : [...previous, key]);
  };

  const download = async (format: Format) => {
    setBusy(format);
    setError('');
    try {
      const response = await fetch(urlFor(format), { credentials: 'include' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'The asset list could not be exported.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="([^"]+)"/)?.[1] ?? `mahe-assets.${format}`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The asset list could not be exported.');
    } finally {
      setBusy(null);
    }
  };

  const print = () => {
    setError('');
    const opened = window.open(urlFor('print'), '_blank');
    if (opened) opened.opener = null;
    else setError('Your browser blocked the print tab. Allow pop-ups for this site and try again.');
  };

  return (
    <ModalDialog title="Print or download asset list" onClose={onClose}>
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="section-title">Print or download assets</h2>
            <p className="muted-copy mt-1 text-sm">{scope} · {count} matching assets</p>
          </div>
          <button type="button" onClick={onClose} className="ui-button ui-button-secondary" aria-label="Close export options">Close</button>
        </div>
        <p className="muted-copy mt-4 text-sm">Includes every asset matching the current filters, across all pages. The asset name is always included.</p>
        <fieldset className="mt-5">
          <legend className="ui-label">Details to include</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_COLUMNS.filter(column => column.key !== 'name').map(column => (
              <label key={column.key} className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--ui-line)] px-3 py-2 text-sm">
                <input type="checkbox" checked={columns.includes(column.key)} onChange={() => toggle(column.key)} className="h-4 w-4 accent-[var(--ui-primary)]" />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="ui-alert mt-4">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" disabled={busy !== null} onClick={() => void download('pdf')} className="ui-button ui-button-primary">{busy === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}</button>
          <button type="button" disabled={busy !== null} onClick={() => void download('docx')} className="ui-button ui-button-secondary">{busy === 'docx' ? 'Preparing Word…' : 'Download Word'}</button>
          <button type="button" disabled={busy !== null} onClick={() => void download('csv')} className="ui-button ui-button-secondary">{busy === 'csv' ? 'Preparing CSV…' : 'Download CSV'}</button>
          <button type="button" disabled={busy !== null} onClick={() => void download('zip')} className="ui-button ui-button-secondary">{busy === 'zip' ? 'Preparing ZIP…' : 'Download ZIP'}</button>
          <button type="button" disabled={busy !== null} onClick={print} className="ui-button ui-button-secondary">Print list</button>
        </div>
        <p className="ui-hint mt-3">ZIP contains the PDF, Word, and CSV versions.</p>
      </div>
    </ModalDialog>
  );
}
