import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  autoComplete?: string;
  disabled?: boolean;
  variant?: 'solid' | 'glass';
  hint?: string;
  isRtl?: boolean;
}

export function PasswordField({
  value,
  onChange,
  placeholder,
  label,
  autoComplete = 'current-password',
  disabled = false,
  variant = 'solid',
  hint,
  isRtl = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const inputId = useId();

  const inputStyle =
    variant === 'glass'
      ? 'bg-white/22 border border-white/35 text-white placeholder:text-white/80 focus:bg-white/28 focus:border-white'
      : 'bg-white border border-[#DCE7F5] text-[#12233F] placeholder:text-[#66758A] focus:border-[#1769E0] shadow-xs';

  const toggleColor =
    variant === 'glass'
      ? 'text-white/85 hover:text-white'
      : 'text-[#66758A] hover:text-[#1769E0]';

  return (
    <div className="space-y-1">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          className={`w-full rounded-full px-5 py-3 text-sm font-medium outline-none transition-all pe-12 ${inputStyle}`}
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={
            isRtl
              ? visible
                ? 'إخفاء كلمة المرور'
                : 'إظهار كلمة المرور'
              : visible
              ? 'Hide password'
              : 'Show password'
          }
          aria-pressed={visible}
          className={`absolute top-1/2 -translate-y-1/2 end-3.5 p-1.5 rounded-full transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1769E0] ${toggleColor}`}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-white/80 px-3">{hint}</p>}
    </div>
  );
}
