'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/useSession';
import AppHeader from '@/components/AppHeader';

export default function ImportPage() {
  const user = useSession();
  const [labs, setLabs] = useState<any[]>([]); const [colleges, setColleges] = useState<any[]>([]); const [types, setTypes] = useState<any[]>([]);
  const [labId, setLabId] = useState(''); const [typeId, setTypeId] = useState(''); const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]); const [sheet, setSheet] = useState(''); const [headers, setHeaders] = useState<string[]>([]); const [targets, setTargets] = useState<string[]>([]); const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any>(null); const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [mappingDirty, setMappingDirty] = useState(false);
  useEffect(() => { if (!user) return; Promise.all([fetch('/api/labs'), fetch('/api/colleges')]).then(async ([a, b]) => { if (a.ok) setLabs((await a.json()).data || []); if (b.ok) setColleges((await b.json()).data || []); }).catch(() => {}); }, [user]);
  useEffect(() => { if (!user) return; fetch(`/api/asset-types?collegeId=${user.collegeId}`).then(async (r) => { if (r.ok) setTypes((await r.json()).data || []); }).catch(() => {}); }, [user]);
  if (!user) return <main className="p-8">Loading…</main>;
  if (!['admin', 'main_technician'].includes(user.role)) return <main className="p-8">You cannot import assets.</main>;
  const selectedType = types.find((item) => String(item.id) === typeId);
  const loadSheet = async (inspect: boolean) => {
    if (!file || !labId || !typeId) { setError('Select a lab, asset type and file first.'); return; }
    setBusy(true); setError(''); setMessage(''); setPreview(null);
    const form = new FormData(); form.set('file', file); form.set('labId', labId); form.set('assetTypeId', typeId);
    if (!inspect && sheet) form.set('sheetName', sheet);
    if (!inspect) form.set('mapping', JSON.stringify(mapping));
    try {
      const response = await fetch('/api/assets/import', { method: 'POST', body: form }); const data = await response.json();
      if (!response.ok) { setError(data.error || 'Could not read the file'); if (data.sheetNames) setSheets(data.sheetNames); return; }
      if (data.inspectOnly) { setSheets(data.sheetNames); setSheet(data.sheetNames[0] || ''); return; }
      setPreview(data); setSheets(data.sheetNames); setHeaders(data.headers); setTargets(data.targets); setMapping(data.mapping || {});
      setMappingDirty(false);
    } catch { setError('Could not preview the file.'); } finally { setBusy(false); }
  };
  const setFieldMapping = (target: string, value: string) => { setMapping((current) => ({ ...current, [target]: value })); setMappingDirty(true); };
  const downloadErrors = () => {
    if (!preview) return;
    const csv = ['Row,Error', ...preview.rows.filter((row: any) => !row.valid).map((row: any) => `${row.rowNumber},"${String(row.error).replaceAll('"', '""')}"`)].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'asset-import-errors.csv'; anchor.click(); URL.revokeObjectURL(url);
  };
  const confirm = async () => { setBusy(true); setError(''); try { const response = await fetch('/api/assets/import/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: preview.token, confirm: true }) }); const data = await response.json(); if (!response.ok) setError(data.error || 'Import failed'); else { setMessage(`Imported ${data.imported}; skipped ${data.skipped}; failed ${data.failed}.`); setPreview(null); } } catch { setError('Import failed.'); } finally { setBusy(false); } };
  return <main className="min-h-screen bg-gray-50 p-4 sm:p-8"><div className="max-w-6xl mx-auto"><AppHeader user={user} colleges={colleges} selectedCollegeId={String(user.collegeId)} onCollegeChange={() => {}} title="Import assets" subtitle="Preview and import spreadsheet rows" />
    <section className="rounded-xl border bg-white p-5 space-y-4"><p className="text-sm text-gray-600">Upload an .xlsx or .csv (8 MB maximum, 1,000 data rows). Destination is selected explicitly. Unknown columns are ignored unless mapped.</p>
      <div className="grid md:grid-cols-3 gap-3"><select className="rounded border p-2" value={labId} onChange={(e) => setLabId(e.target.value)}><option value="">Select destination lab</option>{labs.filter((lab) => user.role === 'admin' ? lab.collegeId === user.collegeId : user.assignedLabIds?.includes(lab.id)).map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}</select><select className="rounded border p-2" value={typeId} onChange={(e) => setTypeId(e.target.value)}><option value="">Select asset type</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select><input className="rounded border p-2" type="file" accept=".xlsx,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setSheets([]); setPreview(null); }} /></div>
      {typeId && <a className="inline-block text-blue-700 underline" href={`/api/assets/import?assetTypeId=${typeId}`}>Download asset type template</a>}
      {file && <button disabled={busy} onClick={() => void loadSheet(true)} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Reading…' : 'Inspect workbook'}</button>}
      {sheets.length > 1 && <div><label className="block text-sm font-medium">Worksheet</label><select className="rounded border p-2" value={sheet} onChange={(e) => setSheet(e.target.value)}>{sheets.map((item) => <option key={item}>{item}</option>)}</select></div>}
      {file && sheets.length <= 1 && !preview && <button disabled={busy} onClick={() => void loadSheet(false)} className="ml-2 rounded border px-4 py-2">Preview rows</button>}
      {sheets.length > 1 && <button disabled={busy} onClick={() => void loadSheet(false)} className="ml-2 rounded border px-4 py-2">Preview selected worksheet</button>}
      {preview && <><h2 className="font-semibold">Column mapping</h2><div className="grid md:grid-cols-2 gap-2">{targets.map((target) => <label key={target} className="flex items-center gap-2 text-sm"><span className="w-44">{target}</span><select className="min-w-0 flex-1 rounded border p-2" value={mapping[target] || ''} onChange={(e) => setFieldMapping(target, e.target.value)}><option value="">Ignore</option>{headers.map((header) => <option key={header}>{header}</option>)}</select></label>)}</div>
        <h2 className="font-semibold">Preview ({preview.rows.length} rows)</h2><div className="max-h-96 overflow-auto border"><table className="w-full text-sm"><thead className="sticky top-0 bg-gray-100"><tr><th className="p-2 text-left">Row</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Serial</th><th className="p-2 text-left">Result</th></tr></thead><tbody>{preview.rows.map((row: any) => <tr key={row.rowNumber} className="border-t"><td className="p-2">{row.rowNumber}</td><td className="p-2">{row.asset?.name || '—'}</td><td className="p-2">{row.asset?.serialNumber || '—'}</td><td className={`p-2 ${row.valid ? 'text-green-700' : 'text-red-700'}`}>{row.valid ? 'Valid' : `${row.duplicate ? 'Duplicate: ' : ''}${row.error}`}</td></tr>)}</tbody></table></div>
        <div className="flex gap-3"><button onClick={downloadErrors} className="rounded border px-3 py-2">Download error report</button>{mappingDirty && <button disabled={busy} onClick={() => void loadSheet(false)} className="rounded border px-3 py-2">Revalidate mapping</button>}<button disabled={busy || mappingDirty || !preview.rows.some((row: any) => row.valid)} onClick={() => void confirm()} className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50">Confirm valid rows, skip the rest</button></div></>}
      {error && <p className="text-red-700" role="alert">{error}</p>}{message && <p className="text-green-700" role="status">{message}</p>}
    </section>
  </div></main>;
}
