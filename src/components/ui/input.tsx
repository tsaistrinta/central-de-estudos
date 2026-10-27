import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type InputProps = ComponentProps<'input'> & {
  /** Ícone à esquerda (Lucide, 15 px). */
  icone?: ReactNode
  /** Elemento à direita, ex.: botão de mostrar senha. */
  sufixo?: ReactNode
}

// Campo no padrão shadcn/ui, na medida Foco (36 px, raio 6, foco com anel azul).
export function Input({ className, icone, sufixo, ...props }: InputProps) {
  return (
    <div
      className={cn(
        'flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm transition-colors',
        'focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20',
        'has-[input[aria-invalid=true]]:border-destructive',
        className,
      )}
    >
      {icone && <span className="text-muted-foreground [&_svg]:size-[15px]">{icone}</span>}
      <input className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint" {...props} />
      {sufixo}
    </div>
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label className={cn('text-[13px] font-medium', className)} {...props} />
}
