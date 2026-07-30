/**
 * Ubah File/Blob jadi data: URL (base64, self-contained).
 *
 * Sengaja tidak pakai `URL.createObjectURL` untuk preview gambar: object URL
 * itu ephemeral dan harus di-revoke manual, dan kalau ke-revoke sebelum
 * semua konsumennya selesai (mis. modal zoom/preview antd Image yang bikin
 * elemen <img> baru saat dibuka), browser nampilin ikon broken-image bawaan.
 * data: URL tidak punya masalah lifecycle seperti itu — sekali dibuat, valid
 * selamanya tanpa perlu di-revoke, jadi aman dipakai ulang oleh preview
 * modal maupun thumbnail sekaligus.
 */
export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
}
