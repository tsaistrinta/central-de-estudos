import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Clock, ExternalLink, FileText, Flag, Library, Link2, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { apagarDoAcervo, denunciar, listarAcervo } from '@/api/acervo'
import { linkDoArquivo } from '@/api/espaco'
import { pessoas as buscarPessoas } from '@/api/academico'
import { Cartao, Esqueleto, Vazio } from '@/components/foco/Base'
import { Button } from '@/components/ui/button'
import NovoItemAcervo from '@/components/acervo/NovoItemAcervo'
import { ROTULO_STATUS_ACERVO, ROTULO_TIPO_ACERVO, tamanhoLegivel } from '@/lib/acervo'
import { meuIdSincrono } from '@/lib/identidade'
import { tempoRelativo } from '@/lib/pessoas'
import { cn } from '@/lib/utils'
import type { ItemAcervo } from '@/types'

const COR_STATUS: Record<ItemAcervo['status'], string> = {
  em_analise: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  publicado: 'bg-[var(--success-soft)] text-[var(--success)]',
  quarentena: 'bg-[var(--destructive-soft)] text-[var(--destructive)]',
  removido: 'bg-muted text-muted-foreground',
}

// Acervo permanente da disciplina: fica para as próximas turmas, sempre verificado pelo Archie.
export default function Acervo({ disciplinaId, disciplinaNome }: { disciplinaId: string; disciplinaNome: string }) {
  const qc = useQueryClient()
  const eu = meuIdSincrono()
  const [novo, setNovo] = useState(false)
  const [aviso, setAviso] = useState('')
  const itens = useQuery({
    queryKey: ['acervo', disciplinaId],
    queryFn: () => listarAcervo(disciplinaId),
    // Enquanto houver envio meu em análise, confere de novo a cada 20 s.
    refetchInterval: (q) => ((q.state.data ?? []).some((i) => i.status === 'em_analise') ? 20_000 : false),
  })
  const pessoas = useQuery({ queryKey: ['pessoas'], queryFn: buscarPessoas, staleTime: 5 * 60_000 })
  const apagar = useMutation({ mutationFn: apagarDoAcervo, onSettled: () => qc.invalidateQueries({ queryKey: ['acervo', disciplinaId] }) })
  const denuncia = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => denunciar(id, motivo),
    onSuccess: () => setAviso('Denúncia registrada. Com 3 denúncias o item sai do ar até o administrador revisar.'),
    onError: () => setAviso('Você já denunciou este item.'),
  })

  async function abrir(i: ItemAcervo) {
    if (i.link_url) window.open(i.link_url, '_blank', 'noreferrer')
    else if (i.arquivo_chave) window.open(await linkDoArquivo(i.arquivo_chave), '_blank', 'noreferrer')
  }

  function aoDenunciar(i: ItemAcervo) {
    const motivo = window.prompt('O que tem de errado neste item? (ex.: conteúdo impróprio, dados pessoais, não é da disciplina)')
    if (motivo && motivo.trim().length >= 3) denuncia.mutate({ id: i.id, motivo: motivo.trim() })
  }

  return (
    <Cartao
      titulo={<span className="inline-flex items-center gap-1.5"><Library size={15} strokeWidth={1.75} /> Acervo da disciplina</span>}
      acao={
        <Button size="sm" variant="outline" onClick={() => setNovo(true)}>
          <Plus /> Compartilhar
        </Button>
      }
    >
      <p className="px-4 pb-2 text-xs text-muted-foreground">Provas antigas, resumos e listas que ficam de um semestre para o outro. Tudo passa pelo Archie antes de aparecer.</p>
      {aviso && <p className="mx-4 mb-2 rounded-md bg-muted px-3 py-2 text-xs">{aviso}</p>}
      {itens.isLoading ? (
        <Esqueleto className="pt-2" />
      ) : !itens.data?.length ? (
        <Vazio acao={<button onClick={() => setNovo(true)} className="font-semibold text-primary hover:underline">Compartilhar o primeiro</button>}>O acervo desta disciplina ainda está vazio.</Vazio>
      ) : (
        <ul>
          {itens.data.map((i) => {
            const meu = i.autor_id === eu
            const Icone = i.link_url ? Link2 : FileText
            return (
              <li key={i.id} className="flex items-start gap-3 border-b border-muted px-4 py-3 last:border-0">
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
                  <Icone size={16} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <button onClick={() => abrir(i)} disabled={i.status !== 'publicado' && !meu} className="block max-w-full truncate text-left text-[13.5px] font-medium hover:text-primary disabled:hover:text-foreground">
                    {i.titulo}
                    {i.link_url && <ExternalLink size={12} className="ml-1 inline" />}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {ROTULO_TIPO_ACERVO[i.tipo]}
                    {i.periodo_origem && ` · ${i.periodo_origem}`} · {meu ? 'você' : !i.autor_id ? 'Ex-aluno' : (pessoas.data?.get(i.autor_id)?.nome ?? 'colega')} · {tempoRelativo(i.criado_em)}
                    {i.arquivo_tamanho ? ` · ${tamanhoLegivel(i.arquivo_tamanho)}` : ''}
                  </p>
                  {i.descricao && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{i.descricao}</p>}
                  {meu && i.status !== 'publicado' && (
                    <p className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium', COR_STATUS[i.status])}>
                      {i.status === 'em_analise' ? <Clock size={12} /> : <ShieldAlert size={12} />}
                      {ROTULO_STATUS_ACERVO[i.status]}
                      {i.status === 'quarentena' && i.moderacao?.motivo ? ` · ${i.moderacao.motivo}` : ''}
                    </p>
                  )}
                </div>
                {meu ? (
                  <button onClick={() => apagar.mutate(i.id)} className="text-muted-foreground hover:text-destructive" aria-label="Apagar do acervo" title="Apagar">
                    <Trash2 size={15} />
                  </button>
                ) : (
                  <button onClick={() => aoDenunciar(i)} className="text-muted-foreground hover:text-destructive" aria-label="Denunciar" title="Denunciar">
                    <Flag size={15} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {novo && <NovoItemAcervo disciplinaId={disciplinaId} disciplinaNome={disciplinaNome} onFechar={() => setNovo(false)} />}
    </Cartao>
  )
}
