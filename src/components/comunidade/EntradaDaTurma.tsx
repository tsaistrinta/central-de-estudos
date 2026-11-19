import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, RefreshCw, Trash2, X } from 'lucide-react'
import { apagarCodigo, codigoDaTurma, decidirPedido, gerarCodigo, mensagemDeEntrada, pedidosParaAprovar } from '@/api/academico'
import { Aviso } from '@/components/auth/AuthUI'
import { Cartao, Vazio } from '@/components/foco/Base'
import { Avatar } from '@/components/comunidade/Avatares'
import { Button } from '@/components/ui/button'
import { tempoRelativo } from '@/lib/pessoas'

// Para o professor da turma (e o admin): código de entrada e pedidos esperando aprovação.
export default function EntradaDaTurma({ turmaId }: { turmaId: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = useState('')
  const [copiado, setCopiado] = useState(false)
  const codigo = useQuery({ queryKey: ['codigo-turma', turmaId], queryFn: () => codigoDaTurma(turmaId) })
  const pedidos = useQuery({ queryKey: ['pedidos-aprovar', turmaId], queryFn: () => pedidosParaAprovar(turmaId) })
  const falhou = (e: unknown) => setErro(mensagemDeEntrada(e))
  const gerar = useMutation({ mutationFn: () => gerarCodigo(turmaId), onSuccess: () => qc.invalidateQueries({ queryKey: ['codigo-turma', turmaId] }), onError: falhou })
  const apagar = useMutation({ mutationFn: () => apagarCodigo(turmaId), onSuccess: () => qc.invalidateQueries({ queryKey: ['codigo-turma', turmaId] }), onError: falhou })
  const decidir = useMutation({
    mutationFn: ({ id, aprovar }: { id: string; aprovar: boolean }) => decidirPedido(id, aprovar),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos-aprovar'] })
      qc.invalidateQueries({ queryKey: ['membros', turmaId] })
    },
    onError: falhou,
  })

  async function copiar() {
    if (!codigo.data) return
    await navigator.clipboard?.writeText(codigo.data).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 1500)
  }

  return (
    <div className="space-y-4">
      <Cartao titulo={<span className="inline-flex items-center gap-1.5"><KeyRound size={15} strokeWidth={1.75} /> Código de entrada</span>}>
        <div className="px-4 pb-4">
          {erro && <div className="mb-3"><Aviso tipo="erro">{erro}</Aviso></div>}
          <p className="mb-3 text-xs text-muted-foreground">Passe este código em sala. Quem digitar em “Adicionar matéria” entra direto, sem precisar de aprovação.</p>
          {codigo.data ? (
            <div className="flex items-center gap-2">
              <span className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-lg font-semibold tracking-[0.3em]">{codigo.data}</span>
              <Button size="icon" variant="outline" onClick={copiar} aria-label="Copiar código">{copiado ? <Check /> : <Copy />}</Button>
            </div>
          ) : (
            <p className="mb-1 text-[13px] text-muted-foreground">Esta turma ainda não tem código.</p>
          )}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant={codigo.data ? 'outline' : 'default'} onClick={() => gerar.mutate()} disabled={gerar.isPending}>
              <RefreshCw /> {codigo.data ? 'Trocar código' : 'Gerar código'}
            </Button>
            {codigo.data && (
              <Button size="sm" variant="ghost" onClick={() => apagar.mutate()} disabled={apagar.isPending}>
                <Trash2 /> Desativar
              </Button>
            )}
          </div>
          {codigo.data && <p className="mt-2 text-[11.5px] text-muted-foreground">Trocar o código não tira ninguém da turma; só o código antigo para de funcionar.</p>}
        </div>
      </Cartao>
      <Cartao titulo={`Pedidos para entrar${pedidos.data?.length ? ` · ${pedidos.data.length}` : ''}`}>
        {!pedidos.data?.length ? (
          <Vazio>Nenhum pedido esperando.</Vazio>
        ) : (
          <ul className="px-4 pb-2">
            {pedidos.data.map((p) => (
              <li key={p.id} className="border-b border-muted py-2.5 last:border-0">
                <div className="flex items-center gap-2.5">
                  <Avatar id={p.usuario_id} pessoa={{ id: p.usuario_id, nome: p.nome, papel: 'aluno' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{p.nome}</p>
                    <p className="truncate text-xs text-muted-foreground">{p.email} · {tempoRelativo(p.criado_em)}</p>
                  </div>
                  <Button size="icon" variant="outline" aria-label={`Recusar ${p.nome}`} onClick={() => decidir.mutate({ id: p.id, aprovar: false })}><X /></Button>
                  <Button size="icon" aria-label={`Aprovar ${p.nome}`} onClick={() => decidir.mutate({ id: p.id, aprovar: true })}><Check /></Button>
                </div>
                {p.mensagem && <p className="mt-1.5 ml-[38px] rounded-md bg-muted px-2.5 py-1.5 text-xs">“{p.mensagem}”</p>}
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  )
}
