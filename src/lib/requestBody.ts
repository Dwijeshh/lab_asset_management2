import { NextResponse } from 'next/server';

const DEFAULT_JSON_LIMIT = 1024 * 1024;
const MAX_JSON_LIMIT = 8 * 1024 * 1024;
const IMPORT_BODY_LIMIT = 8 * 1024 * 1024 + 64 * 1024;

type ReadResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

function configuredJsonLimit(): number {
  const value = process.env.MAX_REQUEST_SIZE?.match(/^(\d+)(kb|mb)$/i);
  if (!value) return DEFAULT_JSON_LIMIT;
  const amount = Number(value[1]);
  if (!Number.isSafeInteger(amount) || amount <= 0) return DEFAULT_JSON_LIMIT;
  return Math.min(
    MAX_JSON_LIMIT,
    amount * (value[2].toLowerCase() === 'mb' ? 1024 * 1024 : 1024)
  );
}

async function readBoundedBytes(request: Request, limit: number): Promise<ReadResult<Buffer>> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) {
      return { ok: false, response: NextResponse.json({ error: 'Invalid Content-Length' }, { status: 400 }) };
    }
    if (Number(declaredLength) > limit) {
      return { ok: false, response: NextResponse.json({ error: 'Request body too large' }, { status: 413 }) };
    }
  }

  if (!request.body) return { ok: true, data: Buffer.alloc(0) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, response: NextResponse.json({ error: 'Request body too large' }, { status: 413 }) };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Could not read request body' }, { status: 400 }) };
  } finally {
    reader.releaseLock();
  }

  return { ok: true, data: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total) };
}

export async function readJsonBody(request: Request): Promise<ReadResult<unknown>> {
  const bytes = await readBoundedBytes(request, configuredJsonLimit());
  if (!bytes.ok) return bytes;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.data);
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, response: NextResponse.json({ error: 'Request body must be an object' }, { status: 400 }) };
    }
    return { ok: true, data };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) };
  }
}

export async function readImportFormData(request: Request): Promise<ReadResult<FormData>> {
  const bytes = await readBoundedBytes(request, IMPORT_BODY_LIMIT);
  if (!bytes.ok) return bytes;
  try {
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers: { 'content-type': request.headers.get('content-type') ?? 'application/octet-stream' },
      body: new Uint8Array(bytes.data),
    });
    return { ok: true, data: await boundedRequest.formData() };
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 }) };
  }
}
