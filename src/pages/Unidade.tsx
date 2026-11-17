import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { tenantAtual } from '@/api/academico'
import { listarFontes } from '@/api/admin'
import { Cabecalho, Cartao } from '@/components/foco/Base'
import EventosOficiais from '@/components/foco/EventosOficiais'

// Fatec · unidade: calendário acadêmico, feriados e editais, com link para a fonte oficial.
export default function Unidade() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantAtual })
  const fontes = useQuery({ queryKey: ['fontes'], queryFn: listarFontes })
  return (
    <div className="space-y-4">
      <Cabecalho titulo={tenant.data?.nome ?? 'Fatec · unidade'} descricao="Calendário acadêmico, feriados, reposições e editais." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <EventosOficiais escopo="unidade" titulo="Calendário acadêmico" />
        <Cartao titulo="Fontes oficiais">
          <ul className="px-4 pb-3">
            {(fontes.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center gap-2 border-b border-muted py-2 text-[13px] last:border-0">
                <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                <a href={f.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label={`Abrir ${f.nome}`}>
                  <ExternalLink size={14} />
                </a>
              </li>
            ))}
          </ul>
        </Cartao>
      </div>
    </div>
  )
}
