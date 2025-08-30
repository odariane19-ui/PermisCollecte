import crypto from 'crypto';

// Validate required environment variables
if (!process.env.QR_PRIVATE_KEY || !process.env.QR_PUBLIC_KEY) {
  throw new Error('QR_PRIVATE_KEY and QR_PUBLIC_KEY environment variables must be set');
}

// Ed25519 key pair for QR code signing
const PRIVATE_KEY = process.env.QR_PRIVATE_KEY;
const PUBLIC_KEY = process.env.QR_PUBLIC_KEY;

export interface QRPayload {
  id: string;
  ts: number;
  v: number;
}

export function generateQRPayload(permitId: string): { payload: string; signature: string } {
  const qrData: QRPayload = {
    id: permitId,
    ts: Date.now(),
    v: 1
  };

  const payload = JSON.stringify(qrData);
  const signature = crypto.sign('sha256', Buffer.from(payload), {
    key: PRIVATE_KEY,
    type: 'pkcs8',
    format: 'pem'
  }).toString('base64');

  return {
    payload: Buffer.from(payload).toString('base64'),
    signature
  };
}

export function verifyQRSignature(payload: string, signature: string): QRPayload | null {
  try {
    const payloadBuffer = Buffer.from(payload, 'base64');
    const signatureBuffer = Buffer.from(signature, 'base64');
    
    const isValid = crypto.verify('sha256', payloadBuffer, {
      key: PUBLIC_KEY,
      type: 'spki',
      format: 'pem'
    }, signatureBuffer);

    if (!isValid) return null;

    const qrData = JSON.parse(payloadBuffer.toString()) as QRPayload;
    
    // Verify timestamp is not too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - qrData.ts > maxAge) return null;

    return qrData;
  } catch (error) {
    return null;
  }
}

export function getPublicKey(): string {
  return PUBLIC_KEY;
}
