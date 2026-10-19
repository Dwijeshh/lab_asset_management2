'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/useSession';
import AppHeader from '@/components/AppHeader';

const blankField = () => ({ fieldKey: '', label: '', type: 'text', required: false, options: [] as string[] });
export default function AssetTypesPage() {
  const user = useSession();
  const [types, setTypes] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [fields, setFields] = useState<any[]>([blankField()]);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const refresh = async () => {
    const selected = collegeId || String(user?.collegeId || '');
    const response = await fetch(`/api/asset-types?collegeId=${selected}`);
    if (response.ok) setTypes((await response.json()).data || []);
  };
  useEffect(() => {
    if (!user) return;
    setCollegeId(String(user.collegeId));
    fetch('/api/colleges').then(async (r) => { if (r.ok) setColleges((await r.json()).data || []); }).catch(() => {});
  }, [user]);
  useEffect(() => { if (user && collegeId) void refresh(); }, [collegeId, user]);
  if (!user) return <main className="p-8">Loading…</main>;
  if (user.role !== 'admin') return <main className="p-8">Admins only.</main>;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setNotice('');
    const data = { name, collegeId: Number(collegeId), fields: fields.map((field, index) => ({ ...field, displayOrder: index, options: typeof field.options === 'string' ? field.options.split(',').map((item: string) => item.trim()).filter(Boolean) : field.options })) };
    const response = await fetch(editing ? `/api/asset-types/${editing}` : '/api/asset-types', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const result = await response.json();
    if (!response.ok) { setError(result.error || 'Could not save the asset type'); return; }
    setName(''); setFields([blankField()]); setEditing(null); setNotice('Asset type saved.'); await refresh();
  };
  const edit = (type: any) => { setEditing(type.id); setName(type.name); setCollegeId(String(type.collegeId)); setFields(type.fields.map((field: any) => ({ ...field, options: (field.options || []).join(', ') }))); };
  const remove = async (id: number) => { const response = await fetch(`/api/asset-types/${id}`, { method: 'DELETE' }); const result = await response.json(); if (!response.ok) setError(result.error || 'Could not remove the type'); else await refresh(); };
  return <main className="min-h-screen bg-gray-50 p-4 sm:p-8"><div className="max-w-6xl mx-auto">
    <AppHeader user={user} colleges={colleges} selectedCollegeId={collegeId} onCollegeChange={setCollegeId} title="Asset types" subtitle="Configure college-specific fields" />
    {user.role === 'admin' && <div className="grid lg:grid-cols-2 gap-6">
      <section className="bg-white rounded-xl border p-5"><h2 className="text-xl font-semibold mb-4">{editing ? 'Edit asset type' : 'Create asset type'}</h2>
        <form onSubmit={save} className="space-y-3"><input required className="w-full rounded border p-2" placeholder="Asset type name" value={name} onChange={(e) => setName(e.target.value)} />
          <select className="w-full rounded border p-2" value={collegeId} onChange={(e) => setCollegeId(e.target.value)}>{colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}</select>
          {fields.map((field, index) => <div key={index} className="grid grid-cols-2 gap-2 rounded border p-3"><input className="rounded border p-2" placeholder="field_key" value={field.fieldKey} onChange={(e) => setFields(fields.map((old, i) => i === index ? { ...old, fieldKey: e.target.value } : old))} /><input className="rounded border p-2" placeholder="Display label" value={field.label} onChange={(e) => setFields(fields.map((old, i) => i === index ? { ...old, label: e.target.value } : old))} /><select className="rounded border p-2" value={field.type} onChange={(e) => setFields(fields.map((old, i) => i === index ? { ...old, type: e.target.value, options: '' } : old))}>{['text', 'number', 'date', 'boolean', 'select'].map((value) => <option key={value}>{value}</option>)}</select><label className="flex items-center gap-2"><input type="checkbox" checked={field.required} onChange={(e) => setFields(fields.map((old, i) => i === index ? { ...old, required: e.target.checked } : old))} />Required</label>{field.type === 'select' && <input className="col-span-2 rounded border p-2" placeholder="Options separated by commas" value={field.options} onChange={(e) => setFields(fields.map((old, i) => i === index ? { ...old, options: e.target.value } : old))} />}</div>)}
          <div className="flex gap-2"><button type="button" className="rounded border px-3 py-2" onClick={() => setFields([...fields, blankField()])}>Add field</button><button className="rounded bg-blue-600 px-4 py-2 text-white">Save</button>{editing && <button type="button" className="rounded border px-3 py-2" onClick={() => { setEditing(null); setName(''); setFields([blankField()]); }}>Cancel</button>}</div>
        </form>{error && <p className="mt-3 text-red-700">{error}</p>}{notice && <p className="mt-3 text-green-700">{notice}</p>}</section>
      <section className="space-y-3">{types.map((type) => <article key={type.id} className="rounded-xl border bg-white p-4"><div className="flex justify-between"><div><h3 className="font-semibold">{type.name}</h3><p className="text-sm text-gray-600">{type.fields.length} custom field(s)</p></div><div className="flex gap-2"><button className="text-blue-700" onClick={() => edit(type)}>Edit</button><button className="text-red-700" onClick={() => void remove(type.id)}>Delete</button></div></div></article>)}</section>
    </div>}
  </div></main>;
}
