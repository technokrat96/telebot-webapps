'use client';

import {Form, FormItemProps, GetProps, Input, InputNumber, Select, Space} from 'antd';
import {useMemo, useState} from 'react';
import { useMasterData } from '@/components/common/MasterDataProvider';

type MoneyInputProps = GetProps<typeof InputNumber> & {
  currency?: string;
}

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
                                     currency = "IDR",
                                     disabled,
                                     ...props
                                   }: MoneyInputProps) {
  const { data: { CURRENCY } } = useMasterData();
  const { value: defaultCurrency, locale: defaultLocale, rate: defaultCurrencyRate } = CURRENCY?.[0] ?? {};

  const {
    isIDR,
    localeActive,
    formatter,
    groupSeparator,
    decimalSeparator,
    currencyRateActive,
  } = useMemo(() => {
    const isIDR = currency === 'IDR';
    const currencyItem = CURRENCY.find((c) => c.value === currency);
    const localeActive = currencyItem?.locale ?? defaultLocale;
    const currencyRateActive = currencyItem?.rate ?? defaultCurrencyRate;
    const formatter = new Intl.NumberFormat(localeActive, {
      currency,
      style: "currency",
      maximumFractionDigits: isIDR ? 0 : 2,
    });
    const sampleParts = formatter.formatToParts(1000000.1);
    const groupSeparator = sampleParts.find(p => p.type === 'group')?.value ?? (isIDR ? "." : ",");
    const decimalSeparator = sampleParts.find(p => p.type === 'decimal')?.value ?? (isIDR ? "," : ".");

    return {
      isIDR,
      formatter,
      localeActive,
      groupSeparator,
      decimalSeparator,
      currencyRateActive,
    }
  }, [currency, CURRENCY, defaultLocale, defaultCurrencyRate]);

  return (
    <InputNumber
      {...props}
      style={props.style ?? { width: '100%' }}
      min={props.min ?? 0}
      max={props.max ?? Number.MAX_SAFE_INTEGER}
      onKeyDown={makeKeyDownHandler(!isIDR)}
      disabled={disabled}
      inputMode="numeric"
      formatter={(val) => {
        if (val === undefined || val === null || val === '') return '';

        const [digits, decimals] = String(val).split(decimalSeparator);
        const digitsOnly = digits.replace(/[^\d]/g, '');

        const numberVal = Number((`${digitsOnly}${decimals ? `.${decimals}` : ''}`));

        return formatter.format(numberVal >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : numberVal);
      }}
      parser={(val) => {
        if (val === undefined || val === null || val === '') return 0;

        if (typeof val == "number") return val;

        const [digits, decimals] = String(val).split(decimalSeparator);
        const digitsOnly = digits.replace(/[^\d]/g, '');

        const numberVal = Number((`${digitsOnly}${decimals ? `.${decimals}` : ''}`));

        return numberVal >= Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : numberVal;
      }}
    />
  )
}