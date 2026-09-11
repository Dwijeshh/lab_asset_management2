'use client';

interface StatsCardsProps {
  assets: any[];
}

export default function StatsCards({ assets }: StatsCardsProps) {
  const totalAssets = assets.length;
  const available = assets.filter(a => a.status === 'available').length;
  const inUse = assets.filter(a => a.status === 'in_use').length;
  const maintenance = assets.filter(a => a.status === 'maintenance').length;

  const stats = [
    {
      label: 'Total Assets',
      value: totalAssets,
      icon: '📦',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Available',
      value: available,
      icon: '✅',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'In Use',
      value: inUse,
      icon: '🔄',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Maintenance',
      value: maintenance,
      icon: '🔧',
      color: 'bg-yellow-50 text-yellow-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
            <div className={`text-4xl ${stat.color} rounded-full p-3`}>
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}