'use client';

import React from 'react';

export interface College {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  contactEmail?: string | null;
  isActive: boolean;
}

interface CollegeSelectorProps {
  userRole: 'admin' | 'main_technician' | 'technician';
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
  const selectedCollege = colleges.find((c) => c.id.toString() === selectedCollegeId);

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-sm text-slate-700 shadow-sm">
        <span className="text-base">🏛️</span>
        <div>
          <span className="text-xs text-slate-500 font-medium block leading-none">Institution</span>
          <span className="font-semibold text-slate-800">
            {userCollege ? `${userCollege.name} (${userCollege.code})` : 'Assigned Institution'}
          </span>
        </div>
        <span className="ml-1 text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-mono">
          🔒 Isolated
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-white border border-indigo-200 px-3 py-1.5 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
      <div className="flex items-center gap-1.5">
        <span className="text-lg">🏢</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 block">
          Institution View:
        </span>
      </div>
      <select
        value={selectedCollegeId}
        onChange={(e) => onCollegeChange(e.target.value)}
        className="text-sm font-medium text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 cursor-pointer pr-4"
      >
        <option value="all">🌐 All MAHE Institutions (Network Overview)</option>
        {colleges.map((col) => (
          <option key={col.id} value={col.id.toString()}>
            🏛️ {col.name} ({col.code})
          </option>
        ))}
      </select>
      {selectedCollege && (
        <span className="hidden sm:inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
          {selectedCollege.code}
        </span>
      )}
    </div>
  );
}
