'use client';

import {retrieveRawInitData} from "@tma.js/sdk-react";
import {fileToDataUrl} from "@/lib/fileToDataUrl";

export function getTelegramInitDataHeader(): Record<string, string> {
  return { 'x-telegram-init-data': getInitData() };
}

function getInitData(): string {
  try {
    const retrieveRawInitDataResult = retrieveRawInitData();
    return retrieveRawInitDataResult ?? "";
  } catch {
    // Not running inside Telegram (e.g. local dev in a plain browser).
    return '';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-telegram-init-data': getInitData(),
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined}),
  /**
   * Upload multipart (mis. gambar item pesanan). Tidak pakai `request()` di
   * atas karena Content-Type untuk FormData harus di-set otomatis oleh
   * browser (dengan boundary-nya), bukan 'application/json'.
   */
  uploadFile: async (path: string, file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(path, {
      method: 'POST',
      headers: {...getTelegramInitDataHeader()},
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? `Upload gagal (${res.status})`);
    }
    return data as { url: string };
  },
  /**
   * Ambil gambar dari private Blob store lewat proxy `/api/upload` (yang
   * otentikasi via header init-data), lalu ubah jadi data: URL yang bisa
   * langsung dipakai di <img src>. Pakai data: URL (bukan object URL) biar
   * tidak perlu di-revoke dan tetap valid dipakai berkali-kali (mis. sama-sama
   * dipakai thumbnail kecil dan modal zoom/preview-nya).
   */
  fetchPrivateImage: async (url: string): Promise<string> => {
    const res = await fetch(`/api/upload?url=${encodeURIComponent(url)}`, {
      headers: {...getTelegramInitDataHeader()},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `Gagal memuat gambar (${res.status})`);
    }
    const blob = await res.blob();
    return fileToDataUrl(blob);
  }
};