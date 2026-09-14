// Shared asset metadata: the only place category/status label & icon maps live.
// Category values mirror the DB enum in src/db/schema.ts.

import type { AssetCategory, AssetStatus } from '@/lib/validation';

export type Role = 'admin' | 'main_technician' | 'technician';

export const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  // Computing & IT Equipment
  { value: 'cpu', label: 'CPU / Desktop' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'printer', label: 'Printer' },
  { value: 'projector', label: 'Projector' },
  { value: 'server', label: 'Server' },
  { value: 'network_device', label: 'Network Device (Switch / Router)' },
  { value: 'ups', label: 'UPS' },
  { value: 'keyboard_mouse', label: 'Keyboard / Mouse' },
  // Electrical & Electronics Equipment
  { value: 'oscilloscope', label: 'Oscilloscope (CRO / DSO)' },
  { value: 'function_generator', label: 'Function / Signal Generator' },
  { value: 'power_supply', label: 'DC Power Supply' },
  { value: 'multimeter', label: 'Digital Multimeter' },
  { value: 'soldering_station', label: 'Soldering Station' },
  { value: 'microcontroller_kit', label: 'Microcontroller / Dev Board Kit' },
  // Mechanical & Workshop Equipment
  { value: 'three_d_printer', label: '3D Printer' },
  { value: 'lathe_machine', label: 'Lathe Machine' },
  { value: 'milling_machine', label: 'Milling / Drilling Machine' },
  { value: 'testing_machine', label: 'Material Testing Machine (UTM)' },
  // General
  { value: 'other', label: 'Other Engineering Asset' },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  ASSET_CATEGORIES.map((c) => [c.value, c.label])
);

export const CATEGORY_ICONS: Record<string, string> = {
  cpu: '🖥️',
  monitor: '🖥️',
  laptop: '💻',
  printer: '🖨️',
  projector: '📽️',
  server: '🗄️',
  network_device: '🌐',
  ups: '🔋',
  keyboard_mouse: '⌨️',
  oscilloscope: '📈',
  function_generator: '〰️',
  power_supply: '⚡',
  multimeter: '📟',
  soldering_station: '🛠️',
  microcontroller_kit: '🤖',
  three_d_printer: '🖨️',
  lathe_machine: '⚙️',
  milling_machine: '🏭',
  testing_machine: '🔬',
  other: '🔧',
};

export const STATUSES: { value: AssetStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In Use' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUSES.map((s) => [s.value, s.label])
);

export const STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800',
  retired: 'bg-gray-100 text-gray-800',
};
