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
    <header className="app-header surface-card mb-6 min-w-0">
      <div className="app-header-main flex min-w-0 items-center gap-4">
        <Image
          src="/logo.jpg"
          alt="MAHE Logo"
          width={64}
          height={64}
          className="app-header-logo h-14 w-auto shrink-0 object-contain rounded-lg border bg-white p-1 sm:h-16"
        />
        <div className="min-w-0">
          {backLink && (
            <button
              onClick={() => router.push(backLink.href)}
              className="app-back-link mb-1 inline-flex min-h-8 items-center gap-1 text-sm font-semibold"
            >
              ← {backLink.label}
            </button>
          )}
          <h1 className="app-page-title">
            {title}
          </h1>
          <p className="app-page-subtitle mt-1 text-sm">{subtitle}</p>
          {(user.role === 'admin' || user.role === 'main_technician') && (
          <nav aria-label="Primary" className="app-primary-nav mt-4 flex flex-wrap gap-1">
              {[...STAFF_NAV, ...(user.role === 'admin' ? [{ label: 'Users', href: '/users' }] : [])].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href ? 'page' : undefined}
                  className={`app-nav-link inline-flex min-h-10 items-center rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors ${
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

      <div className="app-header-tools flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {showCollegeSelector && <CollegeSelector
          userRole={user.role}
          userCollegeId={user.collegeId}
          colleges={colleges}
          selectedCollegeId={selectedCollegeId}
          onCollegeChange={onCollegeChange}
        />}

        <div className="app-header-account flex min-w-0 flex-wrap items-center gap-3">
          <NotificationBell />
          <div className="min-w-0 text-left sm:text-right">
            <span className="block truncate text-sm font-semibold text-gray-800">{user.name}</span>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${ROLE_COLORS[user.role]}`}>
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <button
            onClick={() => logout(router)}
            className="ui-button ui-button-secondary"
            title="Sign out"
          >
            Sign out →
          </button>
        </div>
      </div>
    </header>
  );
}
