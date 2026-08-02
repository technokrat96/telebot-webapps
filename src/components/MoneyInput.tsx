'use client';

import {Input} from 'antd';
import type {GetProps, InputRef} from 'antd';
import type {ClipboardEvent, FocusEvent, KeyboardEvent} from 'react';
import {useLayoutEffect, useMemo, useRef, useState} from 'react';

type MoneyInputProps = Omit<GetProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  currency?: string;
  value?: number;
  onChange?: (value: number) => void;
  min?: number;
  max?: number;
  /** Set false kalau currency-nya sudah ditunjukkan di tempat lain (mis.
   * dropdown CURRENCY di sebelahnya), biar tidak dobel. Default true. */
  showCurrencySymbol?: boolean;
}

// Tombol navigasi/kontrol dibiarkan lewat apa adanya, sisanya di-handle
// manual di handleKeyDown biar perilaku "ketik = geser digit" konsisten.
const PASSTHROUGH_KEYS = [
  'Tab', 'Escape', 'Enter',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
];

/**
 * Input uang dengan perilaku "ketik = geser" ala mesin kasir/ATM:
 * - Kursor di bagian desimal -> tiap digit yang diketik menggeser 2 digit
 *   desimal dari kanan (digit lama ikut geser ke kiri, digit terlama
 *   hilang). Bagian bulat (integer) tidak ikut berubah.
 * - Kursor di bagian digit (bagian bulat) -> digit disisipkan persis di
 *   posisi kursor seperti input angka biasa, kursor lalu tetap di situ
 *   (tidak lompat ke ujung). Bagian desimal tidak ikut berubah.
 * Semua currency (termasuk IDR) selalu punya 2 digit desimal, dan format
 * angkanya (pemisah ribuan/desimal) disamakan ke locale id-ID -- cuma
 * simbol/prefix currency-nya yang ikut kode currency baris ini.
 *
 * Pemisah ribuan/desimal tidak bisa diketik manual -- itu murni hasil
 * format, bukan karakter yang disisipkan.
 */
export default function MoneyInput({
                                      currency = 'IDR',
                                      disabled,
                                      value,
                                      onChange,
                                      min = 0,
                                      max = Number.MAX_SAFE_INTEGER,
                                      style,
                                      showCurrencySymbol = true,
                                      ...restProps
                                    }: MoneyInputProps) {
  // Semua currency (termasuk IDR) sekarang boleh punya 2 digit desimal,
  // format angkanya (pemisah ribuan/desimal) disamakan ke id-ID. Formatter
  // ini murni angka polos (BUKAN style:'currency') -- simbol currency-nya
  // ditampilkan lewat prop `prefix` bawaan Input AntD (lihat di bawah).
  const { decimalDigits, formatter, decimalSeparator, currencySymbol } = useMemo(() => {
    const decimalDigits = 2;
    const formatter = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimalDigits,
      maximumFractionDigits: decimalDigits,
    });
    const decimalSeparator = formatter.formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.';
    // Cuma dipakai buat narik simbol/kode currency-nya (mis. "Rp"/"IDR",
    // "$", "SGD"), bukan buat format angka yang tampil di dalam input.
    const currencySymbol = new Intl.NumberFormat('id-ID', { style: 'currency', currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency;
    return { decimalDigits, formatter, decimalSeparator, currencySymbol };
  }, [currency]);

  const scale = 10 ** decimalDigits;
  const minMinor = Math.round(min * scale);
  const maxMinor = Math.round(max * scale);

  function toMinorUnits(v: number | undefined): number {
    return Math.round((Number(v) || 0) * scale);
  }

  function formatMinorUnits(minor: number): string {
    return formatter.format(minor / scale);
  }

  const currentMinor = Math.min(Math.max(toMinorUnits(value), minMinor), maxMinor);
  const displayText = formatMinorUnits(currentMinor);

  // Prop `prefix` bawaan Input AntD dikelola lewat "affix-wrapper" internal
  // yang di-mount ulang tiap kali nilainya kepasang/kelepas -- kalau itu
  // terjadi PAS input lagi fokus, AntD warning "dynamic add or remove
  // prefix / suffix" (dan fokusnya ilang). Solusinya: selama input fokus,
  // "pin" prefix ke nilai terakhir yang sudah tampil (tidak ikut berubah
  // walau `currencySymbol` berubah di tengah jalan) -- baru di-sync lagi
  // begitu blur. Karena showCurrencySymbol sendiri tidak pernah berubah
  // untuk satu field yang sama, prefix jadi tidak pernah dobel-toggle
  // pas sedang difokus.
  const [isFocused, setIsFocused] = useState(false);
  const [pinnedSymbol, setPinnedSymbol] = useState(currencySymbol);
  // Nge-sync pinnedSymbol ke currencySymbol terbaru langsung di badan
  // render (bukan di useEffect) selama TIDAK fokus -- pola "adjust state
  // while rendering" ala React, guard-nya cukup perbandingan nilai jadi
  // tidak infinite loop. Begitu fokus, blok ini berhenti nge-update,
  // otomatis "mengunci" prefix ke nilai terakhir.
  if (!isFocused && pinnedSymbol !== currencySymbol) {
    setPinnedSymbol(currencySymbol);
  }

  function handleFocus(e: FocusEvent<HTMLInputElement>) {
    setIsFocused(true);
    restProps.onFocus?.(e);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    setIsFocused(false);
    restProps.onBlur?.(e);
  }

  const inputRef = useRef<InputRef>(null);
  const pendingCursorRef = useRef<number | null>(null);

  // Balikin posisi kursor setelah re-render, sesuai yang diminta commit().
  useLayoutEffect(() => {
    if (pendingCursorRef.current !== null) {
      const pos = pendingCursorRef.current;
      pendingCursorRef.current = null;
      inputRef.current?.setSelectionRange(pos, pos);
    }
  });

  function countDigitsBefore(text: string, pos: number): number {
    let count = 0;
    for (let i = 0; i < pos && i < text.length; i++) {
      if (/\d/.test(text[i])) count++;
    }
    return count;
  }

  // Kebalikan dari countDigitsBefore: cari posisi karakter tepat setelah
  // digit ke-N (1-based) di teks hasil format (buat naruh kursor kembali).
  function cursorPosForDigitCount(text: string, digitCount: number): number {
    if (digitCount <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < text.length; i++) {
      if (/\d/.test(text[i])) {
        seen++;
        if (seen === digitCount) return i + 1;
      }
    }
    return text.length;
  }

  function commit(newMinor: number, cursorPos: number) {
    const clamped = Math.min(Math.max(newMinor, minMinor), maxMinor);
    pendingCursorRef.current = cursorPos;
    onChange?.(clamped / scale);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    if (e.ctrlKey || e.metaKey) return;
    if (PASSTHROUGH_KEYS.includes(e.key)) return;

    const el = e.currentTarget;
    const text = el.value;
    const selStart = el.selectionStart ?? text.length;
    const selEnd = el.selectionEnd ?? selStart;
    const hasSelection = selEnd > selStart;
    const isFullSelection = hasSelection && selStart === 0 && selEnd === text.length;

    const decimalSepIndex = decimalDigits > 0 ? text.indexOf(decimalSeparator) : -1;
    const intTextLen = decimalSepIndex === -1 ? text.length : decimalSepIndex;
    const inDecimalSegment = decimalSepIndex !== -1 && selStart > decimalSepIndex;

    const intPart = Math.trunc(currentMinor / scale);
    const fracPart = currentMinor % scale;

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const digit = Number(e.key);

      // Seleksi penuh (mis. select-all) -> anggap mulai dari 0 lagi, digit
      // baru masuk sebagai bagian bulat.
      const baseIntPart = isFullSelection ? 0 : intPart;
      const baseFracPart = isFullSelection ? 0 : fracPart;
      const baseCursor = isFullSelection ? 0 : Math.min(selStart, intTextLen);
      const baseInDecimal = isFullSelection ? false : inDecimalSegment;

      if (baseInDecimal) {
        const newFrac = (baseFracPart * 10 + digit) % scale;
        const newMinor = baseIntPart * scale + newFrac;
        commit(newMinor, formatMinorUnits(newMinor).length);
        return;
      }

      const intDigitsOld = String(baseIntPart);
      const digitIdx = Math.min(countDigitsBefore(text, baseCursor), intDigitsOld.length);
      const newIntDigitsRaw = intDigitsOld.slice(0, digitIdx) + digit + intDigitsOld.slice(digitIdx);
      const newIntDigits = newIntDigitsRaw.replace(/^0+(?=\d)/, '');
      const trimmed = newIntDigitsRaw.length - newIntDigits.length;
      const newIntPart = Number(newIntDigits || '0');
      const newMinor = newIntPart * scale + baseFracPart;
      const newText = formatMinorUnits(newMinor);
      const targetDigitCount = Math.max((digitIdx + 1) - trimmed, 1);
      commit(newMinor, cursorPosForDigitCount(newText, targetDigitCount));
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();

      if (hasSelection) {
        commit(0, 0);
        return;
      }

      if (inDecimalSegment) {
        // Backspace/Delete di bagian desimal sama-sama "batalkan geseran
        // terakhir": digit paling kanan hilang, isian lama geser ke kanan.
        const newFrac = Math.trunc(fracPart / 10);
        const newMinor = intPart * scale + newFrac;
        commit(newMinor, text.length);
        return;
      }

      const intDigitsOld = String(intPart);
      const digitIdxInIntText = Math.min(countDigitsBefore(text, Math.min(selStart, intTextLen)), intDigitsOld.length);
      const removeIdx = e.key === 'Backspace' ? digitIdxInIntText - 1 : digitIdxInIntText;
      if (removeIdx < 0 || removeIdx >= intDigitsOld.length) return;

      const newIntDigitsRaw = intDigitsOld.slice(0, removeIdx) + intDigitsOld.slice(removeIdx + 1);
      const newIntDigits = newIntDigitsRaw.replace(/^0+(?=\d)/, '') || '0';
      const trimmed = newIntDigitsRaw.length - newIntDigits.length;
      const newIntPart = Number(newIntDigits);
      const newMinor = newIntPart * scale + fracPart;
      const newText = formatMinorUnits(newMinor);
      const targetDigitCount = Math.max((e.key === 'Backspace' ? digitIdxInIntText - 1 : digitIdxInIntText) - trimmed, 0);
      commit(newMinor, cursorPosForDigitCount(newText, targetDigitCount));
      return;
    }

    // Blokir tombol karakter lain (pemisah/huruf/dst) -- pemisah ribuan &
    // desimal murni hasil format, tidak boleh diketik manual.
    e.preventDefault();
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    // Paste dimatikan total supaya nilai selalu lewat logika ketik di atas
    // (hindari desync antara teks yang di-paste vs nilai numerik internal).
    e.preventDefault();
  }

  return (
    <Input
      {...restProps}
      ref={inputRef}
      style={style ?? { width: '100%' }}
      disabled={disabled}
      inputMode="decimal"
      prefix={showCurrencySymbol ? pinnedSymbol : undefined}
      value={displayText}
      onChange={() => {}}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
    />
  );
}
