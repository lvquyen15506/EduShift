'use client';

import { useState } from 'react';
import styles from '@/app/register/register.module.css';

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function OtpCodeInput({ id, value, onChange, disabled = false }: Props) {
  const [focused, setFocused] = useState(false);

  return <div className={styles.otpField}>
    <label htmlFor={id}>Mã xác nhận gồm 6 chữ số</label>
    <div className={styles.otpGrid}>
      <input
        id={id}
        className={styles.otpInput}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        aria-label="Mã xác nhận gồm 6 chữ số"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        required
      />
      {Array.from({ length: 6 }, (_, index) => <span
        key={index}
        className={styles.otpSlot + (focused && index === Math.min(value.length, 5) ? ' ' + styles.otpSlotActive : '')}
        aria-hidden="true"
      >{value[index] || ''}</span>)}
    </div>
    <p className={styles.otpHint}>Bạn có thể dán cả mã từ email.</p>
  </div>;
}
