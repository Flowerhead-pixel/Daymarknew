import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const styles: Record<Variant, string> = {
  primary: 'bg-ink text-paper hover:bg-black/80 border border-ink',
  secondary: 'bg-white text-ink border border-line hover:border-ink',
  ghost: 'bg-transparent text-mute hover:text-ink border border-transparent',
  danger: 'bg-white text-ink border border-ink hover:bg-ink hover:text-paper',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  small?: boolean
}

export function Button({ variant = 'secondary', small, className = '', ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        small ? 'px-3.5 py-1.5 text-sm' : 'px-5 py-2.5 text-sm'
      } ${styles[variant]} ${className}`}
    />
  )
}
