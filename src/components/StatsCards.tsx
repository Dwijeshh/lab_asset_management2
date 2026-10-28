'use client';

interface StatsCardsProps {
  counts: { total: number; available: number; inUse: number; maintenance: number };
}

export default function StatsCards({ counts }: StatsCardsProps) {
  const stats = [
    { label: 'Total assets', value: counts.total },
    { label: 'Available', value: counts.available },
    { label: 'In use', value: counts.inUse },
    { label: 'Maintenance', value: counts.maintenance },
  ];

  return (
    <dl className="surface-card stats-overview mb-8" aria-label="Asset status overview">
      {stats.map((stat) => (
        <div key={stat.label} className="stats-overview-item">
          <dt>{stat.label}</dt>
          <dd>{stat.value.toLocaleString()}</dd>
        </div>
      ))}
    </dl>
  );
}
