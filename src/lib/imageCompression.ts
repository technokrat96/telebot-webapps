"use client";

/**
 * Kompres file gambar di browser sebelum diupload — supaya foto dari kamera
 * HP (seringnya beberapa MB) tidak ditolak server gara-gara lewat
 * MAX_IMAGE_SIZE_BYTES. Dipanggil terpusat dari apiClient.uploadFile, jadi
 * otomatis berlaku di semua alur upload (foto bukti kurir & foto item
 * pesanan admin/florist) tanpa perlu duplikasi logic di tiap komponen.
 *
 * Pakai package `browser-image-compression` (bukan canvas manual) karena dua
 * alasan: (1) dia otomatis koreksi EXIF orientation -- foto dari kamera HP
 * sering menyimpan data sensor landscape + flag rotasi di metadata, kalau
 * tidak dikoreksi hasil kompresi bisa jadi miring; (2) proses kompresinya
 * jalan di Web Worker, jadi tidak nge-freeze UI saat memproses foto besar.
 */
import imageCompression from "browser-image-compression";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
} from "@/lib/imageUploadConstraints";

export async function compressImage(
  file: File,
  maxBytes: number = MAX_IMAGE_SIZE_BYTES,
): Promise<File> {
  // Bukan tipe yang kita dukung (mis. HEIC lolos dari <input accept> di
  // sebagian browser) atau sudah cukup kecil -- biarkan lolos apa adanya,
  // validasi tipe & ukuran final tetap dilakukan lagi di /api/upload.
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) || file.size <= maxBytes) {
    return file;
  }

  try {
    return await imageCompression(file, {
      maxSizeMB: maxBytes / (1024 * 1024),
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      initialQuality: 0.85,
    });
  } catch {
    // Gagal kompres (mis. WebView lama tanpa dukungan Web Worker/
    // OffscreenCanvas yang dipakai library) -- biarkan lolos apa adanya,
    // /api/upload tetap jadi penjaga terakhir kalau memang kelewatan.
    return file;
  }
}
