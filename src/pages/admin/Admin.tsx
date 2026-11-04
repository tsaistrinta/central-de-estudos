import { Navigate, NavLink, useParams } from 'react-router-dom'
import PageStub from '@/components/PageStub'
import { cn } from '@/lib/utils'

// Telas 14–18 · painel do dono da plataforma. Acesso restrito ao papel admin a partir da Fase 2.
const abas = {
  visao: { label: 'Visão geral', tela: '14' },
  fontes: { label: 'Fontes monitoradas', tela: '15' },
  curadoria: { label: 'Curadoria da IA', tela: '16' },
  contas: { label: 'Contas e papéis', tela: '17' },
  servidor: { label: 'Servidor e IA', tela: '18' },
} as const

type Aba = keyof typeof abas

export default function Admin() {
  const { aba } = useParams()
  if (!aba || !(aba in abas)) return <Navigate to="/admin/visao" replace />
  const atual = abas[aba as Aba]

  return (
    <PageStub titulo="Administração" descricao="Fontes, curadoria, contas e servidor da plataforma.">
      <div className="mt-5 flex gap-6">
        <nav className="flex w-52 shrink-0 flex-col gap-0.5">
          {Object.entries(abas).map(([chave, { label }]) => (
            <NavLink
              key={chave}
              to={`/admin/${chave}`}
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
