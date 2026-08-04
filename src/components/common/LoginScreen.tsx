'use client';

import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { LockOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

interface LoginFormValues {
  username: string;
  password: string;
}

export default function LoginScreen({
  onLoggedInAction,
  initialError,
}: {
  onLoggedInAction: (token: string) => void;
  initialError?: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  // true kalau server bilang akun ini belum pernah set password sama
  // sekali (beda dari "salah password") — nawarin tombol ke bot Telegram
  // langsung, bukan cuma teks instruksi.
  const [needsTelegramSetup, setNeedsTelegramSetup] = useState(false);

  async function handleSubmit(values: LoginFormValues) {
    setLoading(true);
    setError(null);
    setNeedsTelegramSetup(false);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Login gagal.');
        setNeedsTelegramSetup(data?.code === 'NO_PASSWORD');
        return;
      }
      onLoggedInAction(data.token as string);
    } catch {
      setError('Tidak bisa terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: 24,
      }}
    >
      <Card style={{ maxWidth: 380, width: '100%' }}>
        <Title level={3} style={{ textAlign: 'center', marginTop: 0 }}>
          🌸 Florist App
        </Title>
        <Paragraph type="secondary" style={{ textAlign: 'center' }}>
          Masuk dengan username & password akun kamu.
        </Paragraph>
        {error && (
          <Alert
            type="error"
            title={error}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form layout="vertical" onFinish={handleSubmit} disabled={loading}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: 'Username wajib diisi' }]}
          >
            <Input prefix={<UserOutlined />} autoComplete="username" autoCapitalize="none" />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, message: 'Password wajib diisi' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Masuk
            </Button>
          </Form.Item>
        </Form>
        <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0, fontSize: 13 }}>
          Belum punya password? Buka bot Telegram, kirim <code>/start</code>, lalu ketuk tombol
          untuk mengatur password.
        </Paragraph>
      </Card>
    </div>
  );
}
