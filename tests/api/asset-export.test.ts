import { beforeAll, describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { APP_URL, login, type ApiClient } from '../helpers';

let admin: ApiClient;
let technician: ApiClient;
let kmcLabId: number;

const requestExport = (client: ApiClient | null, query: string) => fetch(`${APP_URL}/api/assets/export?${query}`, {
  headers: client ? { Cookie: client.cookie, 'X-Forwarded-For': '2001:db8:45::12' } : {},
});

beforeAll(async () => {
  admin = await login('admin@manipal.edu');
  technician = await login('tech1@manipal.edu');
  const colleges = await admin.get('/api/colleges');
  const kmc = colleges.body.data.find((item: { code: string }) => item.code === 'KMC');
  const labs = await admin.get(`/api/labs?collegeId=${kmc.id}`);
  kmcLabId = labs.body.data[0].id;
});

describe('asset list exports', () => {
  it('requires sign-in and rejects invalid export options', async () => {
    expect((await requestExport(null, 'format=pdf')).status).toBe(401);
    expect((await requestExport(admin, 'format=xlsx')).status).toBe(400);
    expect((await requestExport(admin, 'format=pdf&columns=name,unknown')).status).toBe(400);
  });

  it('keeps technicians within their institution even with forged filters', async () => {
    const forbidden = await requestExport(technician, `format=pdf&labId=${kmcLabId}`);
    expect(forbidden.status).toBe(404);

    const print = await requestExport(technician, 'format=print&collegeId=all&columns=name,serialNumber');
    expect(print.status).toBe(200);
    const html = await print.text();
    expect(html).toContain('MIT-CS-WK-001');
    expect(html).not.toContain('KMC-SIM-PC-001');
    expect(html).not.toContain('<dt>Location</dt>');
  });

  it('uses the same search, category, and status filters as inventory', async () => {
    const response = await requestExport(admin, 'format=print&search=MIT-CS-WK-001&category=cpu&status=available&columns=name,serialNumber');
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('MIT-CS-WK-001');
    expect(html).not.toContain('MIT-CS-MN-014');
    expect(html).not.toContain('<dt>Location</dt>');
  });

  it('downloads readable PDF, Word, and ZIP files', async () => {
    const query = `collegeId=all&labId=${kmcLabId}&columns=name,serialNumber,location`;
    const pdf = await requestExport(admin, `format=pdf&${query}`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toContain('application/pdf');
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');

    const word = await requestExport(admin, `format=docx&${query}`);
    expect(word.status).toBe(200);
    const wordBytes = Buffer.from(await word.arrayBuffer());
    expect(wordBytes.subarray(0, 2).toString()).toBe('PK');
    const docx = await JSZip.loadAsync(wordBytes);
    const xml = await docx.file('word/document.xml')!.async('string');
    expect(xml).toContain('KMC-SIM-PC-001');
    expect(xml).toContain('Location');
    expect(xml).not.toContain('Purchase date');

    const archive = await requestExport(admin, `format=zip&${query}`);
    expect(archive.status).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(await archive.arrayBuffer()));
    const names = Object.keys(zip.files);
    expect(names.some(name => name.endsWith('.pdf'))).toBe(true);
    expect(names.some(name => name.endsWith('.docx'))).toBe(true);
    expect(names).toContain('README.txt');
  });
});
