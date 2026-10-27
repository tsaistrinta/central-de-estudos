import { Navigate, NavLink, useParams } from 'react-router-dom'
import PageStub from '@/components/PageStub'
import { cn } from '@/lib/utils'

const abas = {
  perfil: { label: 'Perfil', tela: '28' },
  conta: { label: 'Conta e segurança', tela: '29' },
  plano: { label: 'Plano e armazenamento', tela: '30' },
  privacidade: { label: 'Privacidade e dados', tela: '31' },
} as const

type Aba = keyof typeof abas

export default function Configuracoes() {
  const { aba } = useParams()
  if (!aba || !(aba in abas)) return <Navigate to="/configuracoes/perfil" replace />
  const atual = abas[aba as Aba]

  return (
    <PageStub titulo="Configurações" descricao="Perfil, conta, plano e privacidade.">
      <div className="mt-5 flex gap-6">
        <nav className="flex w-52 shrink-0 flex-col gap-0.5">
          {Object.entries(abas).map(([chave, { label }]) => (
            <NavLink
              key={chave}
              to={`/configuracoes/${chave}`}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-2.5 py-2 text-sm transition-colors',
                  isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1 rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {atual.label} — em construção, referência: tela <span className="font-mono">{atual.tela}</span>.
        </div>
      </div>
    </PageStub>
  )
}
