import type { ReactNode } from 'react'

type Props = {
  titulo: string
  descricao: string
  /** Número da tela de referência em docs/design (ex.: "13"). */
  tela?: string
  acoes?: ReactNode
  children?: ReactNode
}

export default function PageStub({ titulo, descricao, tela, acoes, children }: Props) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">{titulo}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
        </div>
        {acoes}
      </div>

      {children ?? (
        <div className="mt-5 rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Em construção{tela && <> — referência: tela <span className="font-mono">{tela}</span></>}.
        </div>
      )}
    </div>
  )
}
