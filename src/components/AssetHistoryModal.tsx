'use client';

import { useEffect, useState } from 'react';

type HistoryItem = { id: string; date: string; kind: string; title: string; actor: string; details: string };

export default function AssetHistoryModal({ asset, onClose }: { asset: { id: number; name: string } | null; onClose: () => void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!asset) return;
    const controller = new AbortController();
    setItems([]);
    setError('');
    setLoading(true);
    fetch(`/api/assets/${asset.id}/history`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load asset history');
        setItems(data.history || []);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load asset history'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [asset]);

  if (!asset) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="asset-history-title" className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-xl">
      <header className="flex items-start justify-between border-b p-5"><div><h2 id="asset-history-title" className="text-xl font-semibold text-gray-900">Asset history</h2><p className="mt-1 text-sm text-gray-600">{asset.name}</p></div><button onClick={onClose} className="rounded px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="Close history">✕</button></header>
      <div className="max-h-[calc(90vh-90px)] overflow-y-auto p-5">
        {loading && <p className="py-8 text-center text-gray-600">Loading asset history…</p>}
        {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
        {!loading && !error && items.length === 0 && <p className="py-8 text-center text-gray-600">No history has been recorded for this asset yet.</p>}
        {!loading && !error && items.length > 0 && <ol className="relative ml-2 border-l border-gray-200">
          {items.map((item) => <li key={item.id} className="relative ml-5 pb-6 last:pb-0">
            <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full border-2 border-white bg-indigo-500 ring-1 ring-indigo-200" />
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><h3 className="font-semibold text-gray-900">{item.title}</h3><time className="text-xs text-gray-500">{new Date(item.date).toLocaleString()}</time></div>
            <p className="mt-1 text-sm text-gray-700">{item.details}</p>
            <p className="mt-1 text-xs text-gray-500">By {item.actor}</p>
          </li>)}
        </ol>}
      </div>
    </section>
  </div>;
}
