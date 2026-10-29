import { describe, expect, it } from 'vitest';
import type { Asset } from '@/db/schema';
import { makeCsv, type AssetReport } from '@/lib/asset-export-files';

describe('CSV asset export', () => {
  it('quotes commas, quotes, and line breaks and prevents spreadsheet formulas', () => {
    const report: AssetReport = {
      title: 'Asset list',
      scope: 'MIT',
      generatedAt: new Date('2026-10-29T00:00:00Z'),
      columns: ['name', 'notes'],
      rows: [{
        asset: { name: '=SUM(1,1)', notes: 'First "quoted" line,\nSecond line' } as Asset,
        collegeName: 'MIT',
        labName: 'Test lab',
      }],
    };

    const csv = makeCsv(report).toString('utf8');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"Asset name","Notes"\r\n');
    expect(csv).toContain('"\'=SUM(1,1)","First ""quoted"" line,\nSecond line"\r\n');
  });
});
