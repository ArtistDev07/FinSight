/**
 * Secure Document Vault & Storage Adapter
 * Enforces strict MIME allowlist, extension validation, 10MB limit, magic-byte inspection,
 * ownerId directory isolation, and optional Firebase Storage write-through when ADC is available.
 */
import fs from 'fs';
import path from 'path';
import { getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.csv', '.xlsx', '.txt', '.png', '.jpg', '.jpeg']);
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.dll', '.sh', '.bat', '.cmd', '.ps1', '.js', '.mjs', '.cjs',
  '.html', '.htm', '.svg', '.php', '.py', '.rb', '.pl', '.jar', '.msi',
]);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'image/png',
  'image/jpeg',
  'application/octet-stream', // Checked against extension & magic bytes
]);

export interface ValidatedUpload {
  safeName: string;
  extension: string;
  mimeType: string;
  buffer: Buffer;
  sizeBytes: number;
  sizeLabel: string;
}

export function formatFileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateFileUpload(
  fileName: string,
  mimeType: string,
  base64OrBuffer: string | Buffer
): ValidatedUpload {
  if (!fileName || typeof fileName !== 'string') {
    throw new Error('File name is required.');
  }

  const baseName = path.basename(fileName.trim()).replace(/[^a-zA-Z0-9._\- ]+/g, '_');
  const ext = path.extname(baseName).toLowerCase();

  if (!ext || BLOCKED_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`Unsupported or unsafe file extension "${ext || '(none)'}". Allowed: PDF, CSV, XLSX, TXT, PNG, JPG.`);
  }

  const normalizedMime = (mimeType || 'application/octet-stream').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(normalizedMime)) {
    throw new Error(`Unsupported MIME type "${normalizedMime}".`);
  }

  const buffer = Buffer.isBuffer(base64OrBuffer)
    ? base64OrBuffer
    : Buffer.from(base64OrBuffer.replace(/^data:[^;]+;base64,/, ''), 'base64');

  if (buffer.length === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds maximum size limit of 10 MB (${formatFileSizeLabel(buffer.length)}).`);
  }

  // Magic-byte verification for binary types
  if (ext === '.pdf' && buffer.subarray(0, 4).toString('ascii') !== '%PDF') {
    throw new Error('Invalid PDF file signature.');
  }
  if (ext === '.png' && !buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    throw new Error('Invalid PNG image signature.');
  }
  if ((ext === '.jpg' || ext === '.jpeg') && !(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) {
    throw new Error('Invalid JPEG image signature.');
  }
  if (ext === '.xlsx' && !buffer.subarray(0, 2).equals(Buffer.from([0x50, 0x4b]))) {
    throw new Error('Invalid XLSX workbook signature.');
  }

  const resolvedMime =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.csv'
      ? 'text/csv'
      : ext === '.xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : ext === '.png'
      ? 'image/png'
      : ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : 'text/plain';

  return {
    safeName: baseName.slice(0, 120),
    extension: ext,
    mimeType: resolvedMime,
    buffer,
    sizeBytes: buffer.length,
    sizeLabel: formatFileSizeLabel(buffer.length),
  };
}

export function createVaultStore(vaultRootDir?: string) {
  const root = vaultRootDir || path.resolve(process.cwd(), '.finsight-data', 'vault');

  function sanitizeSegment(seg: string): string {
    return seg.replace(/[^a-zA-Z0-9._\-]/g, '_');
  }

  async function saveFile(
    ownerId: string,
    folder: 'tax' | 'receipts' | 'statements' | 'invoices',
    upload: ValidatedUpload
  ): Promise<string> {
    const safeOwner = sanitizeSegment(ownerId);
    const key = `${safeOwner}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitizeSegment(upload.safeName)}`;
    const fullPath = path.join(root, key);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, upload.buffer);

    // Optional Firebase Storage write-through when ADC credentials are attached
    if (getApps().length > 0 && process.env.ENABLE_FIREBASE_STORAGE_SYNC === 'true') {
      try {
        const bucket = getStorage().bucket();
        await bucket.file(`users/${key}`).save(upload.buffer, {
          contentType: upload.mimeType,
          metadata: { metadata: { ownerId } },
        });
      } catch {
        // Non-fatal fallback to private local vault
      }
    }

    return key;
  }

  function readFileForOwner(ownerId: string, storageKey: string): Buffer | null {
    const safeOwner = sanitizeSegment(ownerId);
    if (!storageKey.startsWith(`${safeOwner}/`)) {
      return null;
    }
    const resolved = path.resolve(root, storageKey);
    if (!resolved.startsWith(path.resolve(root, safeOwner))) {
      return null;
    }
    if (!fs.existsSync(resolved)) {
      return null;
    }
    return fs.readFileSync(resolved);
  }

  function deleteFileForOwner(ownerId: string, storageKey: string): boolean {
    const safeOwner = sanitizeSegment(ownerId);
    if (!storageKey.startsWith(`${safeOwner}/`)) {
      return false;
    }
    const resolved = path.resolve(root, storageKey);
    if (!resolved.startsWith(path.resolve(root, safeOwner))) {
      return false;
    }
    if (fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      return true;
    }
    return false;
  }

  return {
    saveFile,
    readFileForOwner,
    deleteFileForOwner,
  };
}
