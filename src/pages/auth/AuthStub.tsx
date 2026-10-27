import type { ReactNode } from 'react'

type Props = {
  titulo: string
  descricao: string
  tela: string
  children?: ReactNode
}

/** Esqueleto das telas de acesso até o Marco 2 ligar o Supabase Auth. */
export default function AuthStub({ titulo, descricao, tela, children }: Props) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>
      <div className="mt-5 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Em construção — referência: tela <span className="font-mono">{tela}</span>.
      </div>
      {children && <div className="mt-4 text-center text-sm">{children}</div>}
    </div>
  )
}
