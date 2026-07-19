'use client';

import { Input } from 'antd';
import type { InputRef } from 'antd';
import { forwardRef } from 'react';

function sanitizeNumber(value: string): string {
  const hasLeadingZero = value.startsWith('0');
  const digitsOnly = value.replace(/[^\d]|^0/g, '');
  return hasLeadingZero ? value.length < 2 ? '0' : digitsOnly : digitsOnly;
}

// Wraps antd Input so it only ever contains digits, with an optional
// leading '+'. Works as a controlled Form.Item child (value/onChange
// are injected by antd Form automatically).
const NumberInput = forwardRef<InputRef, React.ComponentProps<typeof Input>>(
  ({ onChange, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        inputMode="numeric"
        onChange={(e) => {
          const sanitized = sanitizeNumber(e.target.value);
          // Bikin event baru dengan value yang sudah dibersihkan supaya
          // antd Form.Item tetap dapat update value seperti biasa.
          onChange?.({
            ...e,
            target: { ...e.target, value: sanitized },
          });
        }}
      />
    );
  }
);

NumberInput.displayName = 'NumberInput';

export default NumberInput;