'use client';

import {Button, Image, Typography} from 'antd';
import {DeleteOutlined} from '@ant-design/icons';
import {useEffect, useState} from 'react';
import {apiClient} from '@/lib/apiClient';
import {fileToDataUrl} from '@/lib/file.util';

/**
 * Satu baris di list foto item pesanan. Bisa merepresentasikan salah satu:
 * - `file`: foto yang baru dipilih, belum diupload — preview lokal langsung
 *   dari File-nya (tidak perlu roundtrip ke server).
 * - `url`: foto yang sudah pernah tersimpan di Blob (private) — perlu
 *   proxy /api/upload (ter-otentikasi) buat ambil isinya.
 */
export default function ImageListItem({
                                         file,
                                         url,
                                         onRemove,
                                       }: {
  file?: File;
  url?: string;
  onRemove: () => void;
}) {
  const [localSrc, setLocalSrc] = useState<string | null>(null);
  const [remoteSrc, setRemoteSrc] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState(false);
  // Pengaman tambahan: kalau <img>-nya sendiri gagal render, jangan biarkan
  // browser nampilin ikon broken-image bawaan — ganti ke placeholder kita
  // sendiri. Disimpan sebagai "src mana yang gagal" (bukan boolean polos)
  // biar otomatis "reset" begitu src-nya berubah, tanpa perlu effect
  // terpisah cuma buat reset state.
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);

  // Preview lokal (dari File yang baru dipilih, belum diupload). Diubah jadi
  // data: URL (bukan URL.createObjectURL) biar tidak ada lifecycle
  // "revoke" yang bisa balapan dengan modal zoom/preview antd Image saat
  // dibuka — data: URL valid selamanya begitu dibuat, aman dipakai ulang
  // oleh thumbnail maupun preview-nya sekaligus.
  useEffect(() => {
    // Tiap instance ImageListItem selalu merepresentasikan salah satu (file
    // ATAU url) seumur hidupnya — `file` tidak pernah berubah dari ada jadi
    // tidak-ada pada instance yang sama, jadi cukup skip kalau belum ada.
    if (!file) return;
    let cancelled = false;
    fileToDataUrl(file).then((dataUrl) => {
      if (!cancelled) setLocalSrc(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Preview dari Blob privat (perlu fetch ter-otentikasi). fetchPrivateImage
  // juga sudah mengembalikan data: URL, jadi tidak perlu revoke.
  useEffect(() => {
    if (!url || file) return;

    let cancelled = false;

    apiClient.fetchPrivateImage(url)
      .then((dataUrl) => {
        if (cancelled) return;
        setRemoteSrc(dataUrl);
        setRemoteError(false);
      })
      .catch(() => {
        if (!cancelled) setRemoteError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url, file]);

  const displaySrc = localSrc ?? remoteSrc;
  const loading = Boolean(url) && !file && !remoteSrc && !remoteError;
  const renderError = displaySrc !== null && erroredSrc === displaySrc;
  const hasError = remoteError || renderError;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 12px',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          flexShrink: 0,
          borderRadius: 6,
          overflow: 'hidden',
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {displaySrc && !renderError ? (
          <Image
            src={displaySrc}
            alt="Foto item"
            width={48}
            height={48}
            style={{objectFit: 'cover'}}
            onError={() => setErroredSrc(displaySrc)}
          />
        ) : (
          <Typography.Text type={hasError ? 'danger' : 'secondary'} style={{fontSize: 10}}>
            {loading ? '...' : (hasError ? '!' : '')}
          </Typography.Text>
        )}
      </div>
      <Typography.Text style={{flex: 1, minWidth: 0}} ellipsis type={hasError ? 'danger' : undefined}>
        {file ? file.name : (hasError ? 'Gagal memuat gambar' : 'Foto tersimpan')}
      </Typography.Text>
      <Button danger icon={<DeleteOutlined/>} onClick={onRemove}/>
    </div>
  );
}
