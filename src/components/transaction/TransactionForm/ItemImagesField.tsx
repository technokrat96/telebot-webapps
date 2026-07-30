'use client';

import {App, Button, Form, FormListFieldData, Space, Upload} from 'antd';
import {CloudUploadOutlined} from '@ant-design/icons';
import {apiClient} from '@/lib/apiClient';
import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_IMAGE_TYPES_LABEL,
  MAX_IMAGE_SIZE_BYTES,
  MAX_IMAGE_SIZE_LABEL,
} from '@/lib/imageUploadConstraints';
import ImageListItem from './ImageListItem';
import type {TransactionFormValues} from './types';

type PendingFile = { clientId: string; file: File };

/**
 * Placeholder tanpa render apa pun — cuma dipakai sebagai child Form.Item
 * biar antd "mendaftarkan" field IMAGE_URLS/IMAGE_FILES ke internal store-nya.
 * Tanpa ini, field yang tidak pernah dirender lewat Form.Item TIDAK ikut
 * kebawa di `getFieldsValue()` versi default: artinya `Form.useWatch` untuk
 * preview tidak pernah update, DAN nilainya juga tidak ikut terkirim ke
 * `onFinish` saat submit (jadi foto beneran tidak pernah keupload!).
 * Sengaja tidak pakai <Input/> biasa karena value-nya array/File, bukan string.
 */
function SilentFieldRegistrar() {
  return null;
}

/**
 * Upload foto (bisa lebih dari satu) untuk satu Item Pesanan, ditampilkan
 * sebagai list.
 *
 * Foto BARU benar-benar diupload ke Vercel Blob saat form disubmit (lihat
 * handleFinish di index.tsx), bukan saat file dipilih di sini — biar tidak
 * menyampah di storage kalau transaksinya batal dibuat. Komponen ini cuma
 * menyimpan File-nya (field IMAGE_FILES) dan menampilkan preview lokal.
 */
export default function ItemImagesField({
                                           field,
                                           form,
                                         }: {
  field: Omit<FormListFieldData, "key">;
  form: ReturnType<typeof Form.useFormInstance<TransactionFormValues>>;
}) {
  const { message } = App.useApp();
  const imageUrls = (Form.useWatch(['details', field.name, 'IMAGE_URLS'], form) as string[] | undefined) ?? [];
  const imageFiles = (Form.useWatch(['details', field.name, 'IMAGE_FILES'], form) as PendingFile[] | undefined) ?? [];

  function patchDetail(patch: Record<string, unknown>) {
    const currentDetails = form.getFieldValue('details') ?? [];
    const next = [...currentDetails];
    next[field.name] = { ...next[field.name], ...patch };
    form.setFieldsValue({ details: next });
  }

  function handleSelectFile(file: File) {
    // Validasi di client dulu (tipe & ukuran) biar user langsung dapat
    // feedback tanpa perlu nunggu roundtrip ke server — server tetap
    // validasi ulang persis sama di /api/upload sebagai lapisan terakhir.
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      message.error(`Format file harus ${ALLOWED_IMAGE_TYPES_LABEL}`);
      return Upload.LIST_IGNORE;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      message.error(`Ukuran file maksimal ${MAX_IMAGE_SIZE_LABEL}`);
      return Upload.LIST_IGNORE;
    }

    // Jangan upload sekarang. File-nya cukup ditambahkan ke daftar file
    // pending di form, baru benar-benar diupload ke Blob storage saat form
    // di-submit — biar tidak menyampah di storage kalau transaksinya batal
    // dibuat.
    const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    patchDetail({ IMAGE_FILES: [...imageFiles, { clientId, file }] });
    return false; // cegah antd auto-upload bawaan
  }

  function handleRemoveFile(clientId: string) {
    // Belum pernah diupload sama sekali, cukup buang dari daftar pending.
    patchDetail({ IMAGE_FILES: imageFiles.filter((f) => f.clientId !== clientId) });
  }

  function handleRemoveUrl(url: string) {
    // Sudah pernah tersimpan di Blob (mis. sedang edit item lama) — hapus beneran.
    apiClient.delete('/api/upload', { url }).catch(() => {});
    patchDetail({ IMAGE_URLS: imageUrls.filter((u) => u !== url) });
  }

  const hasImages = imageUrls.length > 0 || imageFiles.length > 0;

  return (
    <>
      <Form.Item
        {...field}
        name={[field.name, 'IMAGE_URLS']}
        key={[field.name, 'IMAGE_URLS'].join("-")}
        noStyle
      >
        <SilentFieldRegistrar/>
      </Form.Item>
      <Form.Item
        {...field}
        name={[field.name, 'IMAGE_FILES']}
        key={[field.name, 'IMAGE_FILES'].join("-")}
        noStyle
      >
        <SilentFieldRegistrar/>
      </Form.Item>
      <Form.Item label="Foto Item">
        {hasImages && (
          <Space orientation="vertical" size={8} style={{width: '100%', marginBottom: 12}}>
            {imageUrls.map((url) => (
              <ImageListItem key={url} url={url} onRemove={() => handleRemoveUrl(url)}/>
            ))}
            {imageFiles.map(({clientId, file}) => (
              <ImageListItem key={clientId} file={file} onRemove={() => handleRemoveFile(clientId)}/>
            ))}
          </Space>
        )}
        <Upload.Dragger
          accept="image/*"
          multiple
          showUploadList={false}
          beforeUpload={handleSelectFile}
          style={{ padding: '24px 16px' }}
        >
          <p style={{ marginBottom: 12 }}>
            <CloudUploadOutlined style={{ fontSize: 40, color: 'rgba(0, 0, 0, 0.45)' }}/>
          </p>
          <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
            {hasImages ? 'Tambah foto lagi atau seret & lepas di sini' : 'Pilih foto atau seret & lepas di sini'}
          </p>
          <p style={{ color: 'rgba(0, 0, 0, 0.45)', marginBottom: 16 }}>
            {ALLOWED_IMAGE_TYPES_LABEL} — maksimal {MAX_IMAGE_SIZE_LABEL} per file
          </p>
          <Button>
            Cari File
          </Button>
        </Upload.Dragger>
      </Form.Item>
    </>
  );
}
