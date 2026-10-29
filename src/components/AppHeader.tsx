'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import CollegeSelector from '@/components/CollegeSelector';
import NotificationBell from '@/components/NotificationBell';
import type { College } from '@/lib/useSession';
import { logout, ROLE_COLORS, ROLE_LABELS } from '@/lib/useSession';
import type { Role } from '@/lib/assets';

const STAFF_NAV = [
  { label: 'Dashboard', href: '/' },
  { label: 'Labs', href: '/labs' },
  { label: 'Activity log', href: '/logs' },
];

interface AppHeaderProps {
  user: {
    name: string;
    role: Role;
    collegeId: number;
  };
  colleges: College[];
  selectedCollegeId: string;
  onCollegeChange: (collegeId: string) => void;
  backLink?: { label: string; href: string };
  title: string;
  subtitle: string;
  showCollegeSelector?: boolean;
}

/**
 * Shared top bar: logo, title, institution switcher, notification bell,
 * user chip, and sign-out. Used by / and /labs (the /labs/[id] detail page
 * keeps its own back-link layout).
 */
export default function AppHeader({
  user,
  colleges,
  selectedCollegeId,
  onCollegeChange,
  backLink,
  title,
  subtitle,
  showCollegeSelector = true,
}: AppHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="surface-card mb-6 flex min-w-0 flex-col gap-5 p-4 sm:p-6 2xl:flex-row 2xl:items-center 2xl:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <Image
          src="/logo.jpg"
          alt="MAHE Logo"
          width={64}
          height={64}
          className="h-16 w-auto object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
        />
        <div className="min-w-0">
          {backLink && (
            <button
              onClick={() => router.push(backLink.href)}
              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-1"
            >
              ← {backLink.label}
            </button>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            {title}
          </h1>
          <p className="mt-0.5 text-gray-600 font-medium text-sm">{subtitle}</p>
          {(user.role === 'admin' || user.role === 'main_technician') && (
          <nav aria-label="Primary" className="mt-3 flex flex-wrap gap-1.5">
              {[...STAFF_NAV, ...(user.role === 'admin' ? [{ label: 'Users', href: '/users' }] : [])].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
                    pathname === item.href ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {showCollegeSelector && <CollegeSelector
          userRole={user.role}
          userCollegeId={user.collegeId}
          colleges={colleges}
          selectedCollegeId={selectedCollegeId}
          onCollegeChange={onCollegeChange}
        />}

        <div className="flex min-w-0 flex-wrap items-center gap-3 border-t pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-3 border-gray-200">
          <NotificationBell />
          <div className="text-right ml-2">
            <span className="text-sm font-semibold text-gray-800 block">{user.name}</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <button
            onClick={() => logout(router)}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-red-600 rounded-lg hover:bg-red-50 border border-gray-200 transition-colors font-medium"
            title="Sign out"
          >
            Sign out →
          </button>
        </div>
      </div>
    </header>
  );
}
