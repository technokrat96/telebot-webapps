/**
 * Batasan file gambar item pesanan — dipakai bareng oleh validasi client
 * (ItemImageField) dan validasi server (/api/upload) biar selalu sinkron.
 */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
export const ALLOWED_IMAGE_TYPES_LABEL = "JPG atau PNG";

export const MAX_IMAGE_SIZE_BYTES = 1 * 1024 * 1024; // 1MB
export const MAX_IMAGE_SIZE_LABEL = "1MB";
