'use client';

import {useAuthStore} from '@/store/authStore';
import {fileToDataUrl} from "@/lib/file.util";
import {compressImage} from "@/lib/imageCompression";

export function getAuthHeader(): Record<string, string> {
  const token = useAuthStore.getState().token;
  return token ? {Authorization: `Bearer ${token}`} : {} as Record<string, string>;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...(options.headers ?? {}),
    },
  });

  // Token sudah tidak valid/expired — bersihkan supaya AuthProvider
  // menampilkan layar login lagi, bukan spam error di halaman lama.
  if (res.status === 401) {
    useAuthStore.getState().clear();
  }

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
   *
   * File dikompres dulu (kalau perlu) lewat compressImage sebelum dikirim --
   * ditaruh di sini (bukan di tiap komponen pemanggil) supaya semua alur
   * upload (foto bukti kurir, foto item pesanan admin/florist) otomatis
   * kebagian tanpa duplikasi logic.
   */
  uploadFile: async (path: string, file: File): Promise<{ url: string }> => {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append('file', compressed);

    const res = await fetch(path, {
      method: 'POST',
      headers: {...getAuthHeader()},
      body: formData,
    } as RequestInit);

    if (res.status === 401) {
      useAuthStore.getState().clear();
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? `Upload gagal (${res.status})`);
    }
    return data as { url: string };
  },
  /**
   * Ambil gambar dari private Blob store lewat proxy `/api/upload` (yang
   * otentikasi via header Authorization Bearer), lalu ubah jadi data: URL
   * yang bisa langsung dipakai di <img src>. Pakai data: URL (bukan object
   * URL) biar tidak perlu di-revoke dan tetap valid dipakai berkali-kali
   * (mis. sama-sama dipakai thumbnail kecil dan modal zoom/preview-nya).
   */
  fetchPrivateImage: async (url: string): Promise<string> => {
    const res = await fetch(`/api/upload?url=${encodeURIComponent(url)}`, {
      headers: {...getAuthHeader()},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error ?? `Gagal memuat gambar (${res.status})`);
    }
    const blob = await res.blob();
    return fileToDataUrl(blob);
  }
};
