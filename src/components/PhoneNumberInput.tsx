'use client';

import { Input } from 'antd';
import type { InputRef } from 'antd';
import { forwardRef } from 'react';

function sanitizePhoneNumber(value: string): string {
  const hasLeadingPlus = value.startsWith('+');
  const digitsOnly = value.replace(/[^\d]/g, '');
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

// Wraps antd Input so it only ever contains digits, with an optional
// leading '+'. Works as a controlled Form.Item child (value/onChange
// are injected by antd Form automatically).
const PhoneNumberInput = forwardRef<InputRef, React.ComponentProps<typeof Input>>(
  ({ onChange, ...props }, ref) => {
    return (
      <Input
        {...props}
        ref={ref}
        inputMode="tel"
        onChange={(e) => {
          const sanitized = sanitizePhoneNumber(e.target.value);
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

PhoneNumberInput.displayName = 'PhoneNumberInput';

export default PhoneNumberInput;