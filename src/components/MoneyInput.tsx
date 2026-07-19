'use client';

import { GetProps, InputNumber, Select, Space } from 'antd';
import { useState } from 'react';
import { useMasterData } from '@/components/common/MasterDataProvider';

type MoneyInputProps = GetProps<typeof InputNumber> & {
  hasCurrency?: boolean;
  defaultCurrency?: string;
  onCurrencyChange?: (currency: string, rate: number) => void;
};

const ALLOWED_CONTROL_KEYS = [
  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
];

function makeKeyDownHandler(allowDecimal: boolean) {
  return (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey) return;
    if (ALLOWED_CONTROL_KEYS.includes(e.key)) return;

    // '.' only allowed for non-IDR, and only once (no 2 decimal points)
    if (e.key === '.') {
      const alreadyHasDot = (e.target as HTMLInputElement).value.includes('.');
      if (allowDecimal && !alreadyHasDot) return;
      e.preventDefault();
      return;
    }

    // ',' is never typed manually — grouping is automatic via formatter
    if (e.key === ',') {
      e.preventDefault();
      return;
    }

    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };
}

export default function MoneyInput({
                                     value,
                                     onChange,
                                     hasCurrency,
                                     disabled,
                                     placeholder,
                                     defaultCurrency = 'IDR',
                                     onCurrencyChange,
                                     ...props
                                   }: MoneyInputProps) {
  const { data: { CURRENCY, CURRENCY_RATE_IDR } } = useMasterData();

  const CURRENCIES = [
    { label: 'IDR', value: 'IDR', locale: 'id-ID', rateIdr: 1 },
    ...CURRENCY.map((e, i) => {
      const [v, locale] = e.split('_');
      return { label: v, value: v, locale: locale || 'en-US', rateIdr: CURRENCY_RATE_IDR[i] };
    }),
  ];

  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const isIDR = currency === 'IDR';
  const groupingLocale = CURRENCIES.find((c) => c.value === currency)?.locale ?? 'en-US';

  function handleCurrencyChange(c: string) {
    setCurrency(c);
    const currencyFind = CURRENCIES.find((e) => e.value === c)!;

    // Switching TO IDR: enforce integer immediately, so displayed value
    // and stored Form value never drift apart (no leftover decimals).
    if (c === 'IDR' && typeof value === 'number') {
      onChange?.(Math.round(value));
    }

    onCurrencyChange?.(c, currencyFind.rateIdr);
  }

  const input = (
    <InputNumber
      {...props}
      style={props.style ?? { width: '100%' }}
      min={props.min ?? 0}
      max={props.max ?? Number.MAX_SAFE_INTEGER}
      defaultValue={props.defaultValue ?? 0}
      value={value}
      onKeyDown={makeKeyDownHandler(!isIDR)}
      onChange={(v) => onChange?.(v)}
      disabled={disabled}
      placeholder={placeholder}
      inputMode="numeric"
      // Display: IDR -> "1.000.000" (integer, dot grouping).
      // non-IDR -> "1,234.56" (comma grouping, dot decimal, up to 2 digits).
      formatter={(val) => {
        if (val === undefined || val === null || val === '') return '';

        if (isIDR) {
          const digitsOnly = String(val).replace(/[^\d]/g, '');
          if (!digitsOnly) return '';
          return Number(digitsOnly).toLocaleString('id-ID');
        }

        const [intPart, decPart] = String(val).split('.');
        const intDigits = intPart.replace(/[^\d]/g, '');
        const groupedInt = intDigits ? Number(intDigits).toLocaleString(groupingLocale) : '0';
        return decPart !== undefined
          ? `${groupedInt}.${decPart.replace(/[^\d]/g, '').slice(0, 2)}`
          : groupedInt;
      }}
      // Parse back to a clean number. IDR: integer only. non-IDR: keep a
      // single decimal point, strip thousand-separator commas.
      parser={(val) => {
        if (!val) return 0 as unknown as number;

        if (isIDR) {
          const digitsOnly = val.replace(/[^\d]/g, '');
          return (digitsOnly ? Number(digitsOnly) : 0) as unknown as number;
        }

        const cleaned = val.replace(/,/g, '').replace(/[^\d.]/g, '');
        const firstDot = cleaned.indexOf('.');
        const safe =
          firstDot === -1
            ? cleaned
            : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
        return (safe ? Number(safe) : 0) as unknown as number;
      }}
    />
  );

  return hasCurrency ? (
    <Space.Compact style={{ width: '100%' }}>
      <Select
        value={currency}
        onChange={handleCurrencyChange}
        options={CURRENCIES.map(({ label, value }) => ({ label, value }))}
        style={{ width: 80 }}
        disabled={disabled}
      />
      {input}
    </Space.Compact>
  ) : (
    input
  );
}