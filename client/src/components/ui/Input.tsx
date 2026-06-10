import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = '', id, ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ocean-200">
          {label}
        </label>
      )}
      <input
        {...rest}
        id={id}
        className={`
          w-full rounded-lg bg-ocean-900 border px-3 py-2 text-white placeholder-ocean-500
          focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:border-transparent
          transition-colors duration-150
          ${error ? 'border-red-500' : 'border-ocean-700 hover:border-ocean-500'}
          ${className}
        `}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
