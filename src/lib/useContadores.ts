import { useQuery } from '@tanstack/react-query'
import { listarMateriais, listarRevisao } from '@/api/espaco'

/** Números da navegação: itens na caixa de entrada e cartões de revisão vencidos. */
export function useContadores(): Record<string, number> {
  const entrada = useQuery({ queryKey: ['materiais', 'entrada'], queryFn: () => listarMateriais({ entrada: true }), staleTime: 60_000 })
  const revisao = useQuery({ queryKey: ['revisao'], queryFn: listarRevisao, staleTime: 60_000 })
  const hoje = new Date().toISOString().slice(0, 10)
  return {
    '/arquivos': entrada.data?.length ?? 0,
    '/revisao': (revisao.data ?? []).filter((r) => r.proxima_em <= hoje).length,
  }
}
