import { useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { aulasDasTurmas, minhasTurmas, tenantAtual } from '@/api/academico'
import { eventosNoIntervalo, minhasPreferencias, ouvirEventos } from '@/api/agenda'
import { listarPropostas } from '@/api/comunidade'
import { montarItens } from '@/lib/agenda'
import { meuIdSincrono } from '@/lib/identidade'

/** Tudo que a agenda precisa para um intervalo, com cache e prefetch das semanas vizinhas. */
export function useDadosAgenda(de: Date, ate: Date) {
  const qc = useQueryClient()
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas, staleTime: 5 * 60_000 })
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantAtual, staleTime: 30 * 60_000 })
  const ids = (turmas.data ?? []).map((t) => t.id)
  const aulas = useQuery({ queryKey: ['aulas', ids], queryFn: () => aulasDasTurmas(ids), enabled: !!turmas.data, staleTime: 10 * 60_000 })
  const chave = ['agenda', de.toISOString(), ate.toISOString()]
  const eventos = useQuery({ queryKey: chave, queryFn: () => eventosNoIntervalo(de, ate), placeholderData: keepPreviousData })
  const propostas = useQuery({ queryKey: ['propostas', 'abertas', ids], queryFn: () => listarPropostas(ids, true), enabled: !!turmas.data })
  const prefs = useQuery({ queryKey: ['agenda-preferencias'], queryFn: minhasPreferencias })

  // Prefetch: a semana anterior e a próxima já ficam no cache.
  useEffect(() => {
    const passo = ate.getTime() - de.getTime()
    for (const desloc of [-passo, passo]) {
      const d = new Date(de.getTime() + desloc)
      const a = new Date(ate.getTime() + desloc)
      qc.prefetchQuery({ queryKey: ['agenda', d.toISOString(), a.toISOString()], queryFn: () => eventosNoIntervalo(d, a) })
    }
  }, [de, ate, qc])

  // Tempo real: mudou algo visível, recarrega.
  useEffect(() => ouvirEventos(() => qc.invalidateQueries({ queryKey: ['agenda'] })), [qc])

  const itens = useMemo(
    () =>
      montarItens({
        de,
        ate,
        eventos: eventos.data ?? [],
        aulas: aulas.data ?? [],
        turmas: turmas.data ?? [],
        propostas: propostas.data ?? [],
        tenant: tenant.data,
        meuId: meuIdSincrono() ?? undefined,
      }),
    [de, ate, eventos.data, aulas.data, turmas.data, propostas.data, tenant.data],
  )

  return {
    itens,
    turmas: turmas.data ?? [],
    preferencias: prefs.data ?? null,
    carregando: eventos.isLoading || turmas.isLoading,
    erro: eventos.error ?? turmas.error,
  }
}
