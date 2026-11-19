import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, KeyRound, X } from 'lucide-react'
import { entrarComCodigo, mensagemDeEntrada, meusPedidos, minhasTurmas, pedirEntrada, turmasOferecidas } from '@/api/academico'
import { Aviso } from '@/components/auth/AuthUI'
import { PontoMateria } from '@/components/foco/Base'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/lib/auth'

const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

// Adicionar matéria: entra direto com o código do professor, ou pede e espera a aprovação.
// Serve para dependência, adiantamento e aproveitamento de estudos (matérias de outros semestres).
export default function AdicionarMateria({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState('')
  const [mensagem, setMensagem] = useState('')
  const minhas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const pedidos = useQuery({ queryKey: ['meus-pedidos'], queryFn: meusPedidos })
  const oferecidas = useQuery({ queryKey: ['turmas-oferecidas', perfil?.curso_id], queryFn: () => turmasOferecidas(perfil!.curso_id!), enabled: !!perfil?.curso_id })

  const lista = oferecidas.data
  const porSemestre = useMemo(() => {
    const grupos = new Map<number, NonNullable<typeof lista>>()
    for (const t of lista ?? []) {
      const s = t.disciplina.semestre_matriz ?? 0
      grupos.set(s, [...(grupos.get(s) ?? []), t])
    }
    return [...grupos.entries()].sort((a, b) => a[0] - b[0]).map(([s, lista]) => [s, lista.sort((a, b) => a.disciplina.nome.localeCompare(b.disciplina.nome))] as const)
  }, [lista])

  const atualizar = () => {
    qc.invalidateQueries({ queryKey: ['minhas-turmas'] })
    qc.invalidateQueries({ queryKey: ['meus-pedidos'] })
  }
  const comCodigo = useMutation({
    mutationFn: () => entrarComCodigo(codigo),
    onSuccess: () => {
      setErro('')
      setCodigo('')
      setOk('Pronto, você entrou na turma.')
      atualizar()
    },
    onError: (e) => setErro(mensagemDeEntrada(e)),
  })
  const pedir = useMutation({
    mutationFn: (turmaId: string) => pedirEntrada(turmaId, mensagem),
    onSuccess: () => {
      setErro('')
      setOk('Pedido enviado. O professor da turma ou o administrador vai responder.')
      atualizar()
    },
    onError: (e) => setErro(mensagemDeEntrada(e)),
  })

  function aoEnviarCodigo(e: FormEvent) {
    e.preventDefault()
    setOk('')
    if (codigo.trim().length < 4) return setErro('Digite o código que o professor passou.')
    comCodigo.mutate()
  }

  const estaNa = (id: string) => (minhas.data ?? []).some((t) => t.id === id)
  const pediu = (id: string) => (pedidos.data ?? []).some((p) => p.turma_id === id)

  return (
    <>
      <div className="fixed inset-0 z-50 bg-foreground/45" onClick={onFechar} />
      <div className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-48px)] w-[600px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-[var(--sombra-pop)]">
        <div className="flex items-center justify-between px-5 pt-[18px] pb-1">
          <b className="text-base">Adicionar matéria</b>
          <button type="button" onClick={onFechar} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-5 py-3.5">
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {ok && <Aviso tipo="sucesso">{ok}</Aviso>}

          <form onSubmit={aoEnviarCodigo} className="rounded-lg border border-border bg-background p-3.5">
            <Label htmlFor="cod-turma" className="flex items-center gap-1.5">
              <KeyRound size={14} strokeWidth={1.75} /> Tenho o código da turma
            </Label>
            <p className="mt-0.5 mb-2 text-xs text-muted-foreground">O professor passa um código de 6 letras e números. Com ele você entra na hora.</p>
            <div className="flex gap-2">
              <Input id="cod-turma" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={12} placeholder="EX.: K7PX4M" className="font-mono tracking-widest uppercase" autoComplete="off" />
              <Button type="submit" disabled={comCodigo.isPending}>Entrar</Button>
            </div>
          </form>

          <div>
            <p className="text-[13px] font-semibold">Ou peça para entrar</p>
            <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
              Para dependência, adiantamento ou aproveitamento de estudos. Você só vê a conversa e os materiais da turma depois que o professor ou o administrador aprovar.
            </p>
            <Input value={mensagem} onChange={(e) => setMensagem(e.target.value)} maxLength={300} placeholder="Recado para quem aprova (opcional): ex. faço por aproveitamento" />
          </div>

          {oferecidas.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando as matérias do curso…</p>
          ) : porSemestre.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há turmas cadastradas neste período.</p>
          ) : (
            porSemestre.map(([semestre, lista]) => (
              <div key={semestre}>
                <p className="mb-1 font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase">{semestre ? `${semestre}º semestre` : 'Sem semestre'}</p>
                <ul className="rounded-lg border border-border">
                  {lista.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 border-b border-muted px-3 py-2 text-[13px] last:border-0">
                      <PontoMateria cor={`var(--subject-${t.disciplina.cor})`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{t.disciplina.nome}</span>
                        <span className="text-xs text-muted-foreground">
                          {t.professor_nome ?? 'Professor a confirmar'} · {TURNO[t.turno]}
                        </span>
                      </span>
                      {estaNa(t.id) ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--success)]">
                          <Check size={13} /> Você está
                        </span>
                      ) : pediu(t.id) ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock size={13} /> Aguardando
                        </span>
                      ) : (
                        <Button size="sm" variant="outline" disabled={pedir.isPending} onClick={() => { setOk(''); pedir.mutate(t.id) }}>
                          Pedir para entrar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end border-t border-border px-5 py-3.5">
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
        </div>
      </div>
    </>
  )
}
