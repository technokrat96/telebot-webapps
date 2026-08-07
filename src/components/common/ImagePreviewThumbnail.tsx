"use client";

import { Image, Typography } from "antd";
import { useEffect, useState } from "react";
import { apiClient } from "@/lib/apiClient";

/**
 * Thumbnail read-only untuk satu foto item pesanan yang sudah tersimpan di
 * private Blob store. Ambil isinya lewat proxy /api/upload (ter-otentikasi)
 * lalu ubah jadi data: URL — dipakai di halaman florist/kurir dsb yang cuma
 * perlu MENAMPILKAN foto (bukan upload/hapus).
 */
export default function ImagePreviewThumbnail({
  url,
  size = 64,
}: {
  url: string;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchPrivateImage(url)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 6,
        overflow: "hidden",
        background: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {src ? (
        <Image
          src={src}
          alt="Foto item"
          width={size}
          height={size}
          style={{ objectFit: "cover" }}
        />
      ) : (
        <Typography.Text
          type={error ? "danger" : "secondary"}
          style={{ fontSize: 10 }}
        >
          {error ? "!" : "..."}
        </Typography.Text>
      )}
    </div>
  );
}
