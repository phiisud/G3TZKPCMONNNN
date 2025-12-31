import { createHash, randomBytes } from 'crypto';

export function sha256(data: Uint8Array | string): string {
  const input = typeof data === 'string' ? Buffer.from(data) : data;
  return createHash('sha256').update(input).digest('hex');
}

export function sha256Bytes(data: Uint8Array | string): Uint8Array {
  const input = typeof data === 'string' ? Buffer.from(data) : data;
  return new Uint8Array(createHash('sha256').update(input).digest());
}

export function generateNodeId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(16).toString('hex');
  return sha256(`${timestamp}-${random}`).substring(0, 32);
}

export function generateMessageId(): string {
  return sha256(Date.now().toString() + randomBytes(8).toString('hex')).substring(0, 24);
}

export function generateProofId(): string {
  return sha256(Date.now().toString() + randomBytes(16).toString('hex')).substring(0, 32);
}

export function constantTimeCompare(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}