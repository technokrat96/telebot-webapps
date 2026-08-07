"use client";

import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";

const { Title, Paragraph } = Typography;

interface PasswordFormValues {
  password: string;
  confirmPassword: string;
}

export default function SetPasswordGate({
  name,
  initData,
  onDoneAction,
  onSkipAction,
}: {
  name: string | null;
  initData: string;
  onDoneAction: () => void | Promise<void>;
  onSkipAction: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(values: PasswordFormValues) {
    if (values.password !== values.confirmPassword) {
      setError("Konfirmasi password tidak sama.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, password: values.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Gagal menyimpan password.");
        return;
      }
      await onDoneAction();
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setSaving(false);
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
      <Card style={{ maxWidth: 380, width: "100%" }}>
        <Title level={3} style={{ textAlign: "center", marginTop: 0 }}>
          🔑 Set Password
        </Title>
        <Paragraph type="secondary" style={{ textAlign: "center" }}>
          Halo {name}. Buat password sekali ini supaya kamu juga bisa login
          lewat browser biasa di luar Telegram, kapan-kapan kalau perlu.
        </Paragraph>
        {error && (
          <Alert
            type="error"
            message={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form layout="vertical" onFinish={handleSubmit} disabled={saving}>
          <Form.Item
            label="Password baru"
            name="password"
            rules={[
              { required: true, message: "Password wajib diisi" },
              { min: 6, message: "Minimal 6 karakter" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item
            label="Ulangi password"
            name="confirmPassword"
            rules={[{ required: true, message: "Wajib diisi" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              autoComplete="new-password"
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" loading={saving} block>
              Simpan Password
            </Button>
          </Form.Item>
          <Button type="text" block onClick={onSkipAction} disabled={saving}>
            Lewati untuk sekarang
          </Button>
        </Form>
      </Card>
    </div>
  );
}
