'use client';

import { useRouter } from 'next/navigation';
import CollegeSelector from '@/components/CollegeSelector';
import NotificationBell from '@/components/NotificationBell';
import type { College } from '@/lib/useSession';
import { logout, ROLE_COLORS, ROLE_LABELS } from '@/lib/useSession';
import type { Role } from '@/lib/assets';

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
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-6 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:justify-between md:items-center gap-4">
      <div className="flex items-center gap-4">
        <img
          src="/logo.jpg"
          alt="MAHE Logo"
          className="h-16 w-auto object-contain rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
        />
        <div>
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CollegeSelector
          userRole={user.role}
          userCollegeId={user.collegeId}
          colleges={colleges}
          selectedCollegeId={selectedCollegeId}
          onCollegeChange={onCollegeChange}
        />

        <div className="flex items-center gap-3 border-l pl-3 border-gray-200">
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
    </div>
  );
}
