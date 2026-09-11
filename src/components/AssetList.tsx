'use client';

const categoryIcons: Record<string, string> = {
  cpu: '🖥️',
  monitor: '🖥️',
  laptop: '💻',
  printer: '🖨️',
  projector: '📽️',
  server: '🗄️',
  network_device: '🌐',
  ups: '🔋',
  keyboard_mouse: '⌨️',
  oscilloscope: '📈',
  function_generator: '〰️',
  power_supply: '⚡',
  multimeter: '📟',
  soldering_station: '🛠️',
  microcontroller_kit: '🤖',
  three_d_printer: '🖨️',
  lathe_machine: '⚙️',
  milling_machine: '🏭',
  testing_machine: '🔬',
  other: '🔧',
};

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  retired: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  available: 'Available',
  in_use: 'In Use',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

const categoryLabels: Record<string, string> = {
  cpu: 'CPU / Desktop',
  monitor: 'Monitor',
  laptop: 'Laptop',
  printer: 'Printer',
  projector: 'Projector',
  server: 'Server',
  network_device: 'Network Device',
  ups: 'UPS',
  keyboard_mouse: 'Keyboard / Mouse',
  oscilloscope: 'Oscilloscope (CRO / DSO)',
  function_generator: 'Function Generator',
  power_supply: 'DC Power Supply',
  multimeter: 'Digital Multimeter',
  soldering_station: 'Soldering Station',
  microcontroller_kit: 'Microcontroller Kit',
  three_d_printer: '3D Printer',
  lathe_machine: 'Lathe Machine',
  milling_machine: 'Milling / Drilling Machine',
  testing_machine: 'Material Testing Machine',
  other: 'Other Engineering Asset',
};

interface AssetListProps {
  assets: any[];
  currentUser: any;
  onEdit: (asset: any) => void;
  onDelete: (id: number) => void;
  onRequest: (asset: any) => void;
  canDelete: boolean;
}

export default function AssetList({ assets, currentUser, onEdit, onDelete, onRequest, canDelete }: AssetListProps) {
  if (assets.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
        <p className="text-gray-600">Get started by adding your first lab asset.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
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
                    <span className="text-2xl">{categoryIcons[asset.category] || '🔧'}</span>
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
                    {categoryLabels[asset.category] || asset.category}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">{asset.location}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColors[asset.status]}`}>
                    {statusLabels[asset.status] || asset.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-700">{asset.serialNumber || '-'}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {asset.status === 'available' && currentUser?.labId && asset.labId !== currentUser.labId && (
                      <button
                        onClick={() => onRequest(asset)}
                        className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded transition-colors"
                      >
                        Request
                      </button>
                    )}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'main_technician' || asset.labId === currentUser?.labId) && (
                      <button
                        onClick={() => onEdit(asset)}
                        className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        Edit
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => onDelete(asset.id)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}