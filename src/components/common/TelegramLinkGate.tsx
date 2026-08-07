"use client";

import { Button, Card, Result, Space, Typography } from "antd";
import {
  LogoutOutlined,
  ReloadOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useState } from "react";

const { Paragraph } = Typography;

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export default function TelegramLinkGate({
  name,
  onRecheckAction,
  onLogoutAction,
}: {
  name: string | null;
  onRecheckAction: () => void | Promise<void>;
  onLogoutAction: () => void;
}) {
  const [checking, setChecking] = useState(false);

  async function handleRecheck() {
    setChecking(true);
    try {
      await onRecheckAction();
    } finally {
      setChecking(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <Card style={{ maxWidth: 420, width: "100%" }}>
        <Result
          status="warning"
          title="Satu langkah lagi"
          subTitle={`Halo ${name ?? ""}, akun kamu belum terhubung ke Telegram. Buka bot Telegram minimal sekali supaya kami bisa mengirim notifikasi ke kamu.`}
        />
        <Space orientation="vertical" size={12} style={{ width: "100%" }}>
          <Paragraph style={{ margin: 0 }}>
            1. Buka bot Telegram di bawah ini
            {BOT_USERNAME ? "" : " (link bot belum di-set admin)"}.<br />
            2. Kirim <code>/start</code>.<br />
            3. Ketuk tombol yang muncul untuk set/cek password, lalu kembali ke
            sini.
          </Paragraph>
          {BOT_USERNAME && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              href={`https://t.me/${BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
              block
            >
              Buka Bot Telegram
            </Button>
          )}
          <Button
            icon={<ReloadOutlined />}
            loading={checking}
            onClick={handleRecheck}
            block
          >
            Sudah, Cek Lagi
          </Button>
          <Button
            type="text"
            danger
            icon={<LogoutOutlined />}
            onClick={onLogoutAction}
            block
          >
            Logout
          </Button>
        </Space>
      </Card>
    </div>
  );
}
