'use client';

import { AutoComplete, Form, FormListFieldData, Input } from 'antd';
import { useMemo, useState } from 'react';
import debounce from 'lodash/debounce';
import { apiClient } from '@/lib/apiClient';
import type { ProductSearchResult } from '@/types';
import type { TransactionFormValues } from './types';

/**
 * Field "Nama Item": cari produk Shopify sambil ngetik (title/SKU). Kalau
 * dipilih, nama item otomatis jadi "[kode produk]-[nama]" (LABEL dari
 * /api/shopify/products/search) dan Harga Satuan ikut terisi. Kalau
 * produknya tidak ketemu (atau Shopify belum dikonfigurasi), user tetap
 * bebas ketik nama item manual -- AutoComplete tidak memaksa pilih dari
 * daftar.
 */
export default function ProductNameField({
                                            field,
                                            form,
                                          }: {
  field: Omit<FormListFieldData, 'key'>;
  form: ReturnType<typeof Form.useFormInstance<TransactionFormValues>>;
}) {
  const [options, setOptions] = useState<{ value: string; product: ProductSearchResult }[]>([]);
  const [searching, setSearching] = useState(false);

  const doSearch = useMemo(
    () =>
      debounce(async (keyword: string) => {
        if (!keyword.trim()) {
          setOptions([]);
          return;
        }
        setSearching(true);
        try {
          const { results } = await apiClient.get<{ results: ProductSearchResult[] }>(
            `/api/shopify/products/search?q=${encodeURIComponent(keyword)}`
          );
          setOptions(results.map((p) => ({ value: p.LABEL, product: p })));
        } catch {
          // Gagal cari (mis. Shopify belum dikonfigurasi / lagi down) --
          // jangan blokir form, biarkan user isi manual.
          setOptions([]);
        } finally {
          setSearching(false);
        }
      }, 350),
    []
  );

  function handleSelect(value: string) {
    const found = options.find((o) => o.value === value)?.product;
    if (!found) return;

    const currentDetails = form.getFieldValue('details') ?? [];
    const next = [...currentDetails];
    next[field.name] = { ...next[field.name], UNIT_PRICE: found.PRICE };
    form.setFieldsValue({ details: next });
  }

  // Non-production (dev/staging lokal): jangan nyambung ke Shopify sama
  // sekali, biar tidak numpang query API asli tiap develop -- field jadi
  // free text biasa, persis kayak sebelum fitur cari produk ada.
  if (process.env.NODE_ENV !== 'production') {
    return (
      <Form.Item
        {...field}
        label="Nama Item"
        key={[field.name, 'ITEM_NAME'].join('-')}
        name={[field.name, 'ITEM_NAME']}
        rules={[{ required: true, message: 'Wajib diisi' }]}
      >
        <Input placeholder="Buket Mawar Merah (dev mode: free text, tidak connect Shopify)"/>
      </Form.Item>
    );
  }

  return (
    <Form.Item
      {...field}
      label="Nama Item"
      key={[field.name, 'ITEM_NAME'].join('-')}
      name={[field.name, 'ITEM_NAME']}
      rules={[{ required: true, message: 'Wajib diisi' }]}
      extra={searching ? 'Mencari produk di Shopify…' : undefined}
    >
      <AutoComplete
        options={options.map((o) => ({ value: o.value }))}
        showSearch={{ filterOption: false, onSearch: doSearch }}
        onSelect={handleSelect}
        placeholder="Cari produk Shopify, atau ketik nama item bebas"
      />
    </Form.Item>
  );
}
