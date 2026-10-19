'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/useSession';
import AppHeader from '@/components/AppHeader';
import AssetHistoryModal from '@/components/AssetHistoryModal';

export default function RemovedAssetsPage() {
  const user = useSession();
  const [rows, setRows] = useState<any[]>([]);
  const [colleges, setColleges] = useState<any[]>([]);
  const [assetHistory, setAssetHistory] = useState<{ id: number; name: string } | null>(null);
  useEffect(() => {
    if (!user) return;
    Promise.all([fetch('/api/assets/removed'), fetch('/api/colleges')]).then(async ([assetsResponse, collegesResponse]) => {
      if (assetsResponse.ok) setRows((await assetsResponse.json()).data || []);
      if (collegesResponse.ok) setColleges((await collegesResponse.json()).data || []);
    }).catch(() => {});
  }, [user]);
  if (!user) return <main className="p-8 text-center text-gray-600">Loading…</main>;
  return <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
    <div className="max-w-7xl mx-auto">
      <AppHeader user={user} colleges={colleges} selectedCollegeId={user.role === 'admin' ? 'all' : String(user.collegeId)} onCollegeChange={() => {}} title="Removed assets" subtitle="Asset removal history" />
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm"><thead className="bg-gray-50"><tr>{['Asset', 'Lab', 'Reason', 'Removed by', 'Removed on', 'History'].map((label) => <th key={label} className="p-3 text-left">{label}</th>)}</tr></thead><tbody>{rows.map(({ asset, labName, removedByName }) => <tr key={asset.id} className="border-t"><td className="p-3">{asset.name}</td><td className="p-3">{labName || `Lab #${asset.labId}`}</td><td className="p-3">{asset.removalReason}</td><td className="p-3">{removedByName || 'Unknown'}</td><td className="p-3">{asset.removedAt ? new Date(asset.removedAt).toLocaleString() : ''}</td><td className="p-3"><button onClick={() => setAssetHistory({ id: asset.id, name: asset.name })} className="rounded border border-indigo-200 px-3 py-1 text-indigo-700 hover:bg-indigo-50">History</button></td></tr>)}{rows.length === 0 && <tr><td className="p-8 text-center text-gray-500" colSpan={6}>No removed assets.</td></tr>}</tbody></table></div>
    </div>
    <AssetHistoryModal asset={assetHistory} onClose={() => setAssetHistory(null)} />
  </main>;
}
