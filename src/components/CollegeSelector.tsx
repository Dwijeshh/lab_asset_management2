'use client';

import React from 'react';
import type { College, Role } from '@/lib/useSession';
import UiIcon from './UiIcon';

interface CollegeSelectorProps {
  userRole: Role;
  userCollegeId: number;
  colleges: College[];
  selectedCollegeId: string; // 'all' or numeric string ID
  onCollegeChange: (collegeId: string) => void;
}

export default function CollegeSelector({
  userRole,
  userCollegeId,
  colleges,
  selectedCollegeId,
  onCollegeChange,
}: CollegeSelectorProps) {
  const isAdmin = userRole === 'admin';

  const userCollege = colleges.find((c) => c.id === userCollegeId);

  if (!isAdmin) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
        <UiIcon name="pin" className="h-4 w-4 shrink-0" />
        <div>
          <span className="text-xs text-slate-500 font-medium block leading-none">Institution</span>
          <span className="block min-w-0 break-words font-semibold text-slate-800">
            {userCollege ? userCollege.name : 'Assigned Institution'}
          </span>
        </div>
        <span className="ml-1 hidden rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600 sm:inline">
          Your institution
        </span>
      </div>
    );
  }

  return (
    <div className="institution-selector min-w-0 w-full max-w-full rounded-xl border border-blue-200 bg-white px-3 py-2 sm:w-auto sm:min-w-80">
      <label htmlFor="institution-view" className="mb-1 block text-xs font-semibold text-blue-700">Institution view</label>
      <select
        id="institution-view"
        value={selectedCollegeId}
        onChange={(e) => onCollegeChange(e.target.value)}
        className="block w-full min-w-0 truncate bg-transparent text-sm font-medium text-slate-800"
      >
        <option value="all">All MAHE institutions</option>
        {colleges.map((col) => (
          <option key={col.id} value={col.id.toString()}>
            {col.name}
          </option>
        ))}
      </select>
    </div>
  );
}
