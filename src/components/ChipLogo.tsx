import { cn } from '@/lib/utils'

/** Logo de chip/processador da Central de Estudos, na cor primária. */
export default function ChipLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="14 14 72 72" className={cn('size-6 text-primary', className)} aria-hidden="true">
      <rect x="28" y="28" width="44" height="44" rx="9" fill="currentColor" />
      <g fill="currentColor">
        <rect x="42" y="18" width="4.2" height="8" rx="2" /><rect x="54" y="18" width="4.2" height="8" rx="2" />
        <rect x="42" y="74" width="4.2" height="8" rx="2" /><rect x="54" y="74" width="4.2" height="8" rx="2" />
        <rect x="18" y="42" width="8" height="4.2" rx="2" /><rect x="18" y="54" width="8" height="4.2" rx="2" />
        <rect x="74" y="42" width="8" height="4.2" rx="2" /><rect x="74" y="54" width="8" height="4.2" rx="2" />
      </g>
      <g fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="50" r="6" fill="#fff" stroke="none" />
        <path d="M50 44 V36 M50 56 V64 M44 50 H36 M56 50 H64" />
        <circle cx="50" cy="36" r="2.3" fill="#fff" stroke="none" /><circle cx="50" cy="64" r="2.3" fill="#fff" stroke="none" />
        <circle cx="36" cy="50" r="2.3" fill="#fff" stroke="none" /><circle cx="64" cy="50" r="2.3" fill="#fff" stroke="none" />
      </g>
    </svg>
  )
}
