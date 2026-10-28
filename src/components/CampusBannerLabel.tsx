import type { InstitutionBanner } from '@/lib/institutionBanner';

const labels: Record<Exclude<InstitutionBanner, 'other'>, string> = {
  mahe: 'MAHE · Manipal Academy of Higher Education',
  mit: 'MIT · Manipal Institute of Technology',
  kmc: 'KMC · Kasturba Medical College',
  mcods: 'MCODS · Manipal College of Dental Sciences',
  mcops: 'MCOPS · Manipal College of Pharmaceutical Sciences',
};

export default function CampusBannerLabel({ institution, name }: { institution: InstitutionBanner; name?: string }) {
  return <p className="campus-banner-label">{institution === 'other' ? name || 'MAHE institution' : labels[institution]}</p>;
}
