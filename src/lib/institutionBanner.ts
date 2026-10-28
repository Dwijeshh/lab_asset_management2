import type { College } from '@/lib/useSession';

export type InstitutionBanner = 'mahe' | 'mit' | 'kmc' | 'mcods' | 'mcops' | 'other';

export function institutionBanner(college: Pick<College, 'code'> | undefined, allInstitutions = false): InstitutionBanner {
  if (allInstitutions) return 'mahe';

  switch (college?.code.toUpperCase()) {
    case 'MIT': return 'mit';
    case 'KMC': return 'kmc';
    case 'MCODS': return 'mcods';
    case 'MCOPS': return 'mcops';
    default: return 'other';
  }
}
