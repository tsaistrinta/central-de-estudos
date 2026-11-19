import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, FileText, KeyRound, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react'
import { decidirQuarentena, listarQuarentena } from '@/api/acervo'
import { codigoDaTurma, decidirPedido, gerarCodigo, mensagemDeEntrada, pedidosParaAprovar } from '@/api/academico'
import { linkDoArquivo } from '@/api/espaco'
import { Aviso } from '@/components/auth/AuthUI'
import { Cartao, Esqueleto, Vazio } from '@/components/foco/Base'
import { Button } from '@/components/ui/button'
import { ROTULO_CATEGORIA, ROTULO_STATUS_ACERVO, ROTULO_TIPO_ACERVO, tamanhoLegivel } from '@/lib/acervo'
import { tempoRelativo } from '@/lib/pessoas'
import { cn } from '@/lib/utils'
import type { ItemQuarentena } from '@/types'

const quando = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—')
const TURNO: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite' }

// Pedidos para entrar em turmas, de todo o tenant.
export function PedidosDeEntrada() {
  const qc = useQueryClient()
  const [erro, setErro] = useState('')
  const pedidos = useQuery({ queryKey: ['pedidos-aprovar', 'todos'], queryFn: () => pedidosParaAprovar() })
  const decidir = useMutation({
    mutationFn: ({ id, aprovar }: { id: string; aprovar: boolean }) => decidirPedido(id, aprovar),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pedidos-aprovar'] }),
    onError: (e) => setErro(mensagemDeEntrada(e)),
  })
  return (
    <Cartao titulo={`Pedidos para entrar em turmas${pedidos.data?.length ? ` · ${pedidos.data.length}` : ''}`}>
      <p className="px-4 pb-2 text-[13px] text-muted-foreground">
        Quem escolhe turmas no primeiro acesso ou em “Adicionar matéria” só entra depois de aprovado aqui ou pelo professor da turma. Com o código da turma, entra direto.
      </p>
      {erro && <div className="px-4 pb-2"><Aviso tipo="erro">{erro}</Aviso></div>}
      {pedidos.isLoading ? (
        <Esqueleto />
      ) : !pedidos.data?.length ? (
        <Vazio>Nenhum pedido esperando.</Vazio>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-y border-border bg-background text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">Aluno</th>
                <th className="px-2 py-2 font-medium">Turma</th>
                <th className="px-2 py-2 font-medium">Recado</th>
                <th className="px-4 py-2 text-right font-medium">Decisão</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.data.map((p) => (
                <tr key={p.id} className="border-b border-muted align-top">
                  <td className="px-4 py-2">
                    <b className="font-medium">{p.nome}</b>
                    <span className="block text-xs text-muted-foreground">{p.email} · {tempoRelativo(p.criado_em)}</span>
                  </td>
                  <td className="px-2 py-2">
                    {p.disciplina}
                    <span className="block text-xs text-muted-foreground">{p.semestre_matriz ? `${p.semestre_matriz}º semestre · ` : ''}{TURNO[p.turno]}</span>
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">{p.mensagem ?? '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => decidir.mutate({ id: p.id, aprovar: false })}><X /> Recusar</Button>
                      <Button size="sm" onClick={() => decidir.mutate({ id: p.id, aprovar: true })}><Check /> Aprovar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  )
}

/** Célula "Código" na tabela de turmas do admin. */
export function CodigoDaTurmaCelula({ turmaId }: { turmaId: string }) {
  const qc = useQueryClient()
  const codigo = useQuery({ queryKey: ['codigo-turma', turmaId], queryFn: () => codigoDaTurma(turmaId) })
  const gerar = useMutation({ mutationFn: () => gerarCodigo(turmaId), onSuccess: () => qc.invalidateQueries({ queryKey: ['codigo-turma', turmaId] }) })
  if (codigo.data)
    return (
      <button onClick={() => navigator.clipboard?.writeText(codigo.data!).catch(() => {})} title="Copiar" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 font-mono text-[12.5px] tracking-widest hover:bg-muted">
        {codigo.data} <Copy size={12} />
      </button>
    )
  return (
    <Button size="sm" variant="ghost" onClick={() => gerar.mutate()} disabled={gerar.isPending}>
      <KeyRound /> Gerar
    </Button>
  )
}

function Detalhe({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase">{rotulo}</dt>
      <dd className="truncate text-[13px]">{children}</dd>
    </div>
  )
}

function ItemRetido({ i }: { i: ItemQuarentena }) {
  const qc = useQueryClient()
  const [nota, setNota] = useState('')
  const decidir = useMutation({
    mutationFn: (publicar: boolean) => decidirQuarentena(i.id, publicar, nota),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'quarentena'] }),
  })
  const m = i.moderacao ?? {}
  async function abrir() {
    if (i.link_url) window.open(i.link_url, '_blank', 'noreferrer')
    else if (i.arquivo_chave) window.open(await linkDoArquivo(i.arquivo_chave), '_blank', 'noreferrer')
  }
  return (
    <Cartao>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium', i.status === 'quarentena' ? 'bg-[var(--destructive-soft)] text-[var(--destructive)]' : 'bg-[var(--warning-soft)] text-[var(--warning)]')}>
            <ShieldAlert size={12} /> {ROTULO_STATUS_ACERVO[i.status]}
          </span>
          {(m.categorias ?? []).map((c) => (
            <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{ROTULO_CATEGORIA[c] ?? c}</span>
          ))}
          {i.denuncias > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px]">{i.denuncias} denúncia{i.denuncias > 1 ? 's' : ''}</span>}
          <span className="ml-auto text-xs text-muted-foreground">{i.disciplina}</span>
        </div>
        <div>
          <p className="font-semibold">{i.titulo}</p>
          <p className="text-xs text-muted-foreground">{ROTULO_TIPO_ACERVO[i.tipo as keyof typeof ROTULO_TIPO_ACERVO] ?? i.tipo}{i.descricao ? ` · ${i.descricao}` : ''}</p>
        </div>
        {m.motivo && (
          <p className="rounded-md bg-[var(--destructive-soft)] px-3 py-2 text-[13px]">
            <b>Motivo:</b> {m.motivo}
            {typeof m.confianca === 'number' && <span className="text-muted-foreground"> · certeza {Math.round(m.confianca * 100)}%</span>}
          </p>
        )}
        {m.trecho && <p className="rounded-md bg-muted px-3 py-2 font-mono text-[11.5px] break-words">Trecho (com dados mascarados): {m.trecho}</p>}
        <dl className="grid gap-x-4 gap-y-2 rounded-md border border-border p-3 sm:grid-cols-3">
          <Detalhe rotulo="Aluno">{i.autor_nome}</Detalhe>
          <Detalhe rotulo="E-mail">{i.autor_email}</Detalhe>
          <Detalhe rotulo="Curso">{i.autor_curso ? `${i.autor_curso}${i.autor_semestre ? ` · ${i.autor_semestre}º` : ''}` : '—'}</Detalhe>
          <Detalhe rotulo="Enviado em">{quando(i.criado_em)}</Detalhe>
          <Detalhe rotulo="Analisado em">{quando(i.moderado_em)}</Detalhe>
          <Detalhe rotulo="Histórico do aluno">{i.autor_envios} envios · {i.autor_retidos} retidos</Detalhe>
          <Detalhe rotulo="Arquivo">{i.link_url ? i.link_url : `${i.arquivo_nome ?? '—'}${i.arquivo_tamanho ? ` · ${tamanhoLegivel(i.arquivo_tamanho)}` : ''}`}</Detalhe>
          <Detalhe rotulo="Tipo real">{m.tipo_detectado ?? i.arquivo_mime ?? '—'}</Detalhe>
          <Detalhe rotulo="SHA-256">{m.sha256 ? <span className="font-mono text-xs">{m.sha256}</span> : '—'}</Detalhe>
        </dl>
        {m.verificacoes?.length ? <p className="text-xs text-muted-foreground">Verificado: {m.verificacoes.join(' · ')}{m.modelo ? ` · modelo ${m.modelo}` : ''}</p> : null}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={abrir}>
            {i.link_url ? <ExternalLink /> : <FileText />} Abrir com cuidado
          </Button>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota da decisão (opcional)" className="h-8 min-w-0 flex-1 rounded-md border border-border px-2.5 text-[13px]" />
          <Button size="sm" variant="destructive" onClick={() => decidir.mutate(false)} disabled={decidir.isPending}>
            <Trash2 /> Remover
          </Button>
          <Button size="sm" onClick={() => decidir.mutate(true)} disabled={decidir.isPending}>
            <ShieldCheck /> Liberar
          </Button>
        </div>
      </div>
    </Cartao>
  )
}

// Quarentena do acervo: o que o Archie (ou 3 denúncias) reteve, com quem enviou e por quê.
export function Quarentena() {
  const itens = useQuery({ queryKey: ['admin', 'quarentena'], queryFn: listarQuarentena })
  const retidos = (itens.data ?? []).filter((i) => i.status === 'quarentena')
  const analise = (itens.data ?? []).filter((i) => i.status === 'em_analise')
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        Tudo que vai para o acervo público passa pelo Archie: tipo real do arquivo, código embutido (macro, JavaScript), dados pessoais de terceiros e conteúdo impróprio, ilícito ou malicioso. O que ele reteve fica aqui com os dados de quem enviou. Itens com 3 denúncias também voltam para cá.
      </p>
      {itens.isLoading && <Esqueleto />}
      {!itens.isLoading && retidos.length === 0 && (
        <Cartao>
          <Vazio>Nada na quarentena.</Vazio>
        </Cartao>
      )}
      {retidos.map((i) => <ItemRetido key={i.id} i={i} />)}
      {analise.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-semibold">Esperando o Archie · {analise.length}</h2>
          <p className="text-[13px] text-muted-foreground">Se o worker estiver desligado, eles ficam aqui. Você pode liberar ou remover sem esperar.</p>
          {analise.map((i) => <ItemRetido key={i.id} i={i} />)}
        </>
      )}
    </div>
  )
}
