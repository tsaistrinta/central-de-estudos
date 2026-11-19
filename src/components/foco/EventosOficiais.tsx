import { useMemo } from 'react'
import { linkDaFonte } from '@/lib/fonte'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { tenantAtual } from '@/api/academico'
import { eventosNoIntervalo } from '@/api/agenda'
import { Cartao, Esqueleto, Vazio } from './Base'
import { PilulaEvento, SeloStatus, SeloArchie } from './Selos'
import type { EscopoEvento } from '@/types'

// Lista de datas da unidade ou do curso, sempre com a fonte (telas 11 e 15).
export default function EventosOficiais({ escopo, titulo }: { escopo: EscopoEvento; titulo: string }) {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantAtual, staleTime: 30 * 60_000 })
  const de = useMemo(() => new Date(`${tenant.data?.inicio_periodo ?? `${new Date().getFullYear()}-01-01`}T00:00`), [tenant.data])
  const ate = useMemo(() => new Date(`${tenant.data?.fim_periodo ?? `${new Date().getFullYear()}-12-31`}T23:59`), [tenant.data])
  const eventos = useQuery({ queryKey: ['agenda', de.toISOString(), ate.toISOString()], queryFn: () => eventosNoIntervalo(de, ate), enabled: !!tenant.data })
  const hoje = new Date().toISOString()
  const lista = (eventos.data ?? []).filter((e) => e.escopo === escopo).sort((a, b) => a.inicio.localeCompare(b.inicio))
  const proximos = lista.filter((e) => (e.fim ?? e.inicio) >= hoje)
  const passados = lista.filter((e) => (e.fim ?? e.inicio) < hoje).reverse()

  const Linha = ({ e }: { e: (typeof lista)[number] }) => (
    <li className="flex flex-wrap items-center gap-2.5 border-b border-muted py-2.5 last:border-0">
      <span className="w-[92px] font-mono text-xs text-muted-foreground">
        {new Date(e.inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
        {e.fim && e.fim.slice(0, 10) !== e.inicio.slice(0, 10) && ` a ${new Date(e.fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium">{e.titulo}</span>
      <PilulaEvento tipo={e.tipo} />
      {e.origem === 'archie' ? <SeloArchie rotulo="Captado do site" /> : <SeloStatus status={e.status} />}
      {e.documento_url && (
        <a href={linkDaFonte(e.documento_url)} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" aria-label="Ver a fonte">
          <ExternalLink size={14} />
        </a>
      )}
    </li>
  )

  return (
    <Cartao titulo={titulo}>
      {eventos.isLoading ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <Vazio>Nenhuma data ainda. O Archie preenche lendo o site da Fatec (Fase 5).</Vazio>
      ) : (
        <div className="px-4 pb-3">
          <ul>{proximos.map((e) => <Linha key={e.id} e={e} />)}</ul>
          {passados.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[12.5px] text-muted-foreground">Já passaram ({passados.length})</summary>
              <ul className="opacity-70">{passados.map((e) => <Linha key={e.id} e={e} />)}</ul>
            </details>
          )}
        </div>
      )}
    </Cartao>
  )
}
