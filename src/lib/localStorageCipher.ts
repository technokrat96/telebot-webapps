'use client';

// Obfuscation ringan buat isi localStorage (bukan proteksi asli terhadap
// XSS — key-nya tetap "kelihatan" oleh JS yang jalan di halaman ini juga,
// termasuk skrip attacker kalau ada. Ini cuma nyembunyiin token dari orang
// yang asal buka DevTools/localStorage tanpa jalanin kode aplikasi.
//
// NEXT_PUBLIC_* di-inline jadi literal string saat build, bukan diambil
// dari server saat runtime — nama variabelnya sengaja dibuat generik biar
// nggak langsung kelihatan "ini kunci enkripsi" pas ada yang lihat .env.
const SEED = process.env.NEXT_PUBLIC_CLIENT_REV_TAG ?? 'florist-app-default-tag';

let cachedKey: Promise<CryptoKey> | null = null;

function getKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle
      .digest('SHA-256', new TextEncoder().encode(SEED))
      .then((digest) => crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']));
  }
  return cachedKey;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function hasWebCrypto(): boolean {
  return typeof window !== 'undefined' && !!window.crypto?.subtle;
}

export async function packText(plain: string): Promise<string> {
  if (!hasWebCrypto()) return plain;
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  const combined = new Uint8Array(iv.length + cipherBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuf), iv.length);
  return bytesToBase64(combined);
}

export async function unpackText(packed: string): Promise<string | null> {
  if (!hasWebCrypto()) return packed;
  try {
    const key = await getKey();
    const combined = base64ToBytes(packed);
    const iv = combined.slice(0, 12);
    const cipherBuf = combined.slice(12);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
    return new TextDecoder().decode(plainBuf);
  } catch {
    // Data lama (belum ter-enkripsi) atau rusak — anggap tidak ada, biar
    // user tinggal login ulang, bukan crash.
    return null;
  }
}
