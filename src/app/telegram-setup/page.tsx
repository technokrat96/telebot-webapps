'use client';

import {useCallback, useEffect, useState} from 'react';
import {Alert, Button, Card, Form, Input, Space, Spin, Tag, Typography} from 'antd';
import {LockOutlined} from '@ant-design/icons';
import {init} from '@tma.js/sdk';
import {retrieveRawInitData} from '@tma.js/sdk-react';

const { Title, Paragraph } = Typography;

interface CheckResult {
  name: string;
  username: string;
  roles: string[];
  hasPassword: boolean;
}

interface PasswordFormValues {
  password: string;
  confirmPassword: string;
}

// Halaman ini HANYA bisa dipakai kalau dibuka dari dalam Telegram (lewat
// tombol web_app di bot, mis. /start) — initData Telegram-nya dipakai untuk
// membuktikan identitas user tanpa perlu password (karena tujuannya justru
// membuat password itu). Ini juga jadi tempat "kunjungan wajib ke Telegram"
// yang meng-capture chatId/telegramId user (lihat /api/auth/set-password).
export default function TelegramSetupPage() {
  const [initData, setInitData] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const runCheck = useCallback(async (raw: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: raw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Gagal memuat data akun.');
        return;
      }
      setCheck(data);
    } catch {
      setError('Tidak bisa terhubung ke server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Cek initData Telegram itu panggilan imperatif ke SDK (bisa throw, dan
    // hasilnya tidak bisa dihitung murni saat render) — jadi setState sinkron
    // di sini memang perlu, bukan sesuatu yang bisa di-derive.
    let raw: string | undefined;
    try {
      init();
      raw = retrieveRawInitData();
    } catch {
      raw = undefined;
    }
    if (!raw) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setError('Halaman ini hanya bisa dibuka dari dalam Telegram. Kirim /start ke bot lalu ketuk tombolnya.');
      return;
    }
    setInitData(raw);
    runCheck(raw);
  }, [runCheck]);

  async function handleSubmit(values: PasswordFormValues) {
    if (!initData) return;
    if (values.password !== values.confirmPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData, password: values.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? 'Gagal menyimpan password.');
        return;
      }
      setDone(true);
    } catch {
      setError('Tidak bisa terhubung ke server.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', alignItems: 'center', padding: 24 }}>
      <Card style={{ maxWidth: 420, width: '100%' }}>
        <Title level={3} style={{ textAlign: 'center', marginTop: 0 }}>
          🌸 Florist App
        </Title>

        {loading && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <Spin size="large" />
          </div>
        )}

        {!loading && error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />
        )}

        {!loading && !error && check && !done && (
          <>
            <Paragraph>
              Halo <b>{check.name}</b> (@{check.username}){' '}
              <Space wrap>
                {check.roles.map((r) => (
                  <Tag key={r}>{r}</Tag>
                ))}
              </Space>
            </Paragraph>
            <Paragraph type="secondary">
              {check.hasPassword
                ? 'Akun kamu sudah punya password. Isi form di bawah untuk menggantinya.'
                : 'Ini kunjungan pertamamu — buat password untuk login ke webapp di luar Telegram.'}
            </Paragraph>
            <Form layout="vertical" onFinish={handleSubmit} disabled={saving}>
              <Form.Item
                label="Password baru"
                name="password"
                rules={[
                  { required: true, message: 'Password wajib diisi' },
                  { min: 6, message: 'Minimal 6 karakter' },
                ]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Form.Item
                label="Ulangi password"
                name="confirmPassword"
                rules={[{ required: true, message: 'Wajib diisi' }]}
              >
                <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0 }}>
                <Button type="primary" htmlType="submit" loading={saving} block>
                  Simpan Password
                </Button>
              </Form.Item>
            </Form>
          </>
        )}

        {done && (
          <Alert
            type="success"
            showIcon
            message="Password berhasil disimpan"
            description="Sekarang kamu bisa login ke webapp di luar Telegram pakai username & password ini."
          />
        )}
      </Card>
    </div>
  );
}
