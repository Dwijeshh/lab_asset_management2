'use client';

import { CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/lib/assets';
import AssetActions from '@/components/AssetActions';

interface AssetListProps {
  assets: any[];
  currentUser: any;
  onEdit: (asset: any) => void;
  onDelete: (id: number) => void;
  onRequest: (asset: any) => void;
  canDelete: boolean;
  hasFilters?: boolean;
}

export default function AssetList({ assets, currentUser, onEdit, onDelete, onRequest, canDelete, hasFilters = false }: AssetListProps) {
  if (assets.length === 0) {
    return (
      <div className="surface-card ui-empty">
        <h3>No assets found</h3>
        <p>{hasFilters ? 'Try a different search or clear the filters.' : 'No assets are registered in this view yet.'}</p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3 sm:hidden" aria-label="Asset inventory">
        {assets.map((asset) => (
          <li key={asset.id} className="surface-card p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words font-semibold leading-snug text-gray-900">{asset.name}</h3>
                {asset.manufacturer && <p className="muted-copy mt-1 text-sm">{asset.manufacturer}{asset.model && ` · ${asset.model}`}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${STATUS_COLORS[asset.status]}`}>
                {STATUS_LABELS[asset.status] || asset.status}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div><dt className="muted-copy text-xs">Category</dt><dd className="mt-0.5">{CATEGORY_LABELS[asset.category] || asset.category}</dd></div>
              <div><dt className="muted-copy text-xs">Serial number</dt><dd className="mt-0.5 break-all">{asset.serialNumber || '—'}</dd></div>
              <div className="col-span-2"><dt className="muted-copy text-xs">Location</dt><dd className="mt-0.5">{asset.location || 'Not recorded'}</dd></div>
            </dl>
            <div className="mt-4 border-t border-[var(--ui-line)] pt-3">
              <AssetActions asset={asset} currentUser={currentUser} onEdit={onEdit} onDelete={onDelete} onRequest={onRequest} canDelete={canDelete} />
            </div>
          </li>
        ))}
      </ul>
      <div className="surface-card hidden max-w-full overflow-hidden sm:block">
      <div className="data-region" role="region" aria-label="Asset inventory table" tabIndex={0}>
        <table className="data-table min-w-[1000px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Asset
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Serial Number
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium text-gray-900">{asset.name}</div>
                      {asset.manufacturer && (
                        <div className="text-sm text-gray-500">
                          {asset.manufacturer} {asset.model && `- ${asset.model}`}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">
                    {CATEGORY_LABELS[asset.category] || asset.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">{asset.location}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[asset.status]}`}>
                    {STATUS_LABELS[asset.status] || asset.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">{asset.serialNumber || '-'}</span>
                </td>
                <td className="min-w-[11rem] px-6 py-4 text-right">
                  <AssetActions asset={asset} currentUser={currentUser} onEdit={onEdit} onDelete={onDelete} onRequest={onRequest} canDelete={canDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </>
  );
}
