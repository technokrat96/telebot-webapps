'use client';

import {GetProps, InputNumber, Select, Space} from 'antd';
import {useState} from 'react';
import {useMasterData} from "@/components/common/MasterDataProvider";

type MoneyInputProps = GetProps<typeof InputNumber> & {
  hasCurrency?: boolean;
  defaultCurrency?: string;
  onCurrencyChange?: (currency: string) => void;
}

const ALLOWED_CONTROL_KEYS = [
  'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
];

function handleDigitsOnlyKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  // Allow Ctrl/Cmd combos (copy, paste, select all, undo, etc.)
  if (e.ctrlKey || e.metaKey) return;

  if (ALLOWED_CONTROL_KEYS.includes(e.key)) return;

  // Block anything that isn't a single digit 0-9.
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
}

// Numeric-only currency input: addonBefore is a currency dropdown (IDR/USD).
// Display shows thousand separators (e.g. "1.000.000"), but the value
// stored in the Form (and sent on submit) is always a plain number
// (e.g. 1000000) — formatter only affects what's shown, parser converts
// the displayed string back to a clean number.
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
    {label: 'IDR', value: 'IDR', locale: "id-ID", rateIdr: 1},
    ...CURRENCY.map((e, i) => {
      const [v, locale] = e.split("_");
      return {
        label: v,
        value: v,
        locale,
        rateIdr: CURRENCY_RATE_IDR[i]
      }
    }),
  ];
  const [currency, setCurrency] = useState<string>(defaultCurrency);

  const input = (
    <InputNumber
      {...props}
      style={props.style ?? {width: '100%'}}
      min={props.min ?? 0}
      max={props.max ?? Number.MAX_SAFE_INTEGER}
      defaultValue={props.defaultValue ?? 0}
      value={value}
      onKeyDown={handleDigitsOnlyKeyDown}
      onChange={(v) => onChange?.(v)}
      disabled={disabled}
      placeholder={placeholder}
      inputMode="numeric"
      // Display: plain number -> "1.000.000" (thousand separators, id-ID locale)
      formatter={(val) => {
        if (val === undefined || val === null || val === '') return '';
        const digitsOnly = String(val).replace(/[^\d]/g, '');
        if (!digitsOnly) return '';
        const currencyLocale = CURRENCIES.find(e => e.value == currency)?.locale;
        const safeDigits = (+digitsOnly) > Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : +digitsOnly;
        return new Intl.NumberFormat(currencyLocale ?? 'id-ID', {
          style: 'currency',
          currency: currency ?? 'IDR',
          minimumFractionDigits: 0
        }).format(safeDigits);
      }}
      parser={(val) => {
        if (!val) return 0 as unknown as number;
        const digitsOnly = val.replace(/[^\d]/g, '');
        return (digitsOnly ? +digitsOnly : 0) as unknown as number;
      }}
    />
  )

  return (
    <>
      {
        hasCurrency ? (
          <Space.Compact style={{width: '100%'}}>
            <Select
              value={currency}
              onChange={(c) => {
                setCurrency(c);
                onCurrencyChange?.(c);
              }}
              options={CURRENCIES.map(({ label, value }) => ({ label, value }))}
              style={{width: 80}}
              disabled={disabled}
            />
            {input}
          </Space.Compact>
        ) : (input)
      }
    </>
  )
}