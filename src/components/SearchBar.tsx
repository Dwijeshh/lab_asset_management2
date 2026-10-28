'use client';

import { useState } from 'react';
import { ASSET_CATEGORIES, STATUSES } from '@/lib/assets';

const categories: { value: string; label: string }[] = [
  { value: '', label: 'All Categories' },
  ...ASSET_CATEGORIES,
];

const statuses: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  ...STATUSES,
];

interface SearchBarProps {
  onSearch: (search: string, status: string, category: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');

  const handleSearchChange = (value: string) => {
    setSearch(value);
    onSearch(value, status, category);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    onSearch(search, value, category);
  };

  const handleCategoryChange = (value: string) => {
    setCategory(value);
    onSearch(search, status, value);
  };

  return (
    <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:items-center">
      <div className="relative min-w-0 sm:col-span-2 lg:flex-1">
        <input
          type="text"
          aria-label="Search assets by name, serial number, manufacturer, or location"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search assets..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <svg
          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <select
        aria-label="Filter assets by status"
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="min-w-0 w-full lg:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {statuses.map(s => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter assets by category"
        value={category}
        onChange={(e) => handleCategoryChange(e.target.value)}
        className="min-w-0 w-full lg:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      >
        {categories.map(c => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  );
}
