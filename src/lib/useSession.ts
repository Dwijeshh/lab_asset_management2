'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@/lib/assets';

export type { Role };

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  collegeId: number;
  labId: number | null;
}

export interface Lab {
  id: number;
  name: string;
  code: string;
  department?: string | null;
  building?: string | null;
  floor?: string | null;
  roomNumber?: string | null;
  capacity?: number | null;
  isActive?: boolean;
  collegeId?: number;
}

export interface College {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  contactEmail?: string | null;
  isActive: boolean;
}

/**
 * Client session hook: fetches /api/auth/me once and redirects to /login on
 * 401. Shared by /, /labs, and /labs/[id] instead of three copies of
 * fetchUser.
 */
export function useSession(): SessionUser | null {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (response.status === 401) {
          router.push('/login');
          return;
        }
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setUser(data.user);
      } catch {
        router.push('/login');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return user;
}

export async function logout(router: ReturnType<typeof useRouter>): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  } catch (error) {
    console.error('Error logging out:', error);
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'System Administrator',
  main_technician: 'Main Technician (Head)',
  technician: 'Lab Technician',
};

export const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-purple-100 text-purple-800 border-purple-200',
  main_technician: 'bg-blue-100 text-blue-800 border-blue-200',
  technician: 'bg-green-100 text-green-800 border-green-200',
};
