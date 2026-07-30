'use client';

import {Space} from 'antd';
import ImagePreviewThumbnail from './ImagePreviewThumbnail';

/** Baris kecil thumbnail foto-foto satu item pesanan (kalau ada). */
export default function ItemImageGallery({urls, size = 64}: { urls?: string[]; size?: number }) {
  if (!urls || urls.length === 0) return null;

  return (
    <Space wrap size={8}>
      {urls.map((url) => (
        <ImagePreviewThumbnail key={url} url={url} size={size}/>
      ))}
    </Space>
  );
}
