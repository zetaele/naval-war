import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-ocean-500 hover:bg-ocean-400 text-white shadow-lg shadow-ocean-500/20 disabled:bg-ocean-800 disabled:text-ocean-500',
  secondary: 'bg-ocean-800 hover:bg-ocean-700 text-ocean-100 border border-ocean-600 disabled:opacity-50',
  danger: 'bg-red-600 hover:bg-red-500 text-white disabled:bg-red-900 disabled:text-red-400',
  ghost: 'bg-transparent hover:bg-ocean-800 text-ocean-300 hover:text-white disabled:opacity-50',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled ?? loading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:ring-offset-2 focus:ring-offset-ocean-950
        disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading && (
        <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
      )}
      {children}
    </button>
  );
}
