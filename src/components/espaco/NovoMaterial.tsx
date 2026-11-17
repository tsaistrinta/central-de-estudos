import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp, Link2, StickyNote, X } from 'lucide-react'
import { criarMaterial, enviarArquivo } from '@/api/espaco'
import { mensagemDeErro } from '@/api/auth'
import { Aviso } from '@/components/auth/AuthUI'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Material, MinhaTurma } from '@/types'

const TIPOS = [
  { id: 'anotacao', nome: 'Anotação', icone: StickyNote },
  { id: 'link', nome: 'Link', icone: Link2 },
  { id: 'arquivo', nome: 'Arquivo', icone: FileUp },
] as const

type Props = {
  turmas: MinhaTurma[]
  /** Disciplina já escolhida (tela da matéria). */
  disciplinaId?: string
  /** true = vai para a caixa de entrada, sem matéria. */
  entrada?: boolean
  /** Já marca "compartilhar com a turma" (aba Materiais da turma). */
  compartilharPadrao?: boolean
  onFechar: () => void
}

// Novo material: anotação, link ou arquivo (enviado direto para o R2).
export default function NovoMaterial({ turmas, disciplinaId, entrada, compartilharPadrao, onFechar }: Props) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<Material['tipo']>('anotacao')
  const [titulo, setTitulo] = useState('')
  const [url, setUrl] = useState('')
  const [conteudo, setConteudo] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [disc, setDisc] = useState(disciplinaId ?? '')
  const [compartilhar, setCompartilhar] = useState(!!compartilharPadrao)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState('')
  const turma = turmas.find((t) => t.disciplina_id === disc)

  const salvar = useMutation({
    mutationFn: async () => {
      let chave: string | undefined
      if (tipo === 'arquivo') {
        if (!arquivo) throw new Error('Escolha um arquivo.')
        if (arquivo.size > 25 * 1024 * 1024) throw new Error('O arquivo passa de 25 MB.')
        chave = (await enviarArquivo(arquivo, setProgresso)).chave
      }
      return criarMaterial({
        tipo,
        titulo: titulo.trim() || arquivo?.name || url || 'Sem título',
        url: tipo === 'link' ? url : null,
        conteudo: tipo === 'anotacao' ? conteudo : null,
        arquivo_chave_r2: chave ?? null,
        arquivo_tamanho: arquivo?.size ?? null,
        arquivo_mime: arquivo?.type ?? null,
        disciplina_id: entrada ? null : disc || null,
        turma_id: compartilhar && turma ? turma.id : null,
        na_entrada: !!entrada && !disc,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materiais'] })
      onFechar()
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  })

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    salvar.mutate()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-foreground/45" onClick={onFechar} />
      <form onSubmit={aoEnviar} className="fixed top-1/2 left-1/2 z-50 flex w-[540px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-[var(--sombra-pop)]">
        <div className="flex items-center justify-between px-5 pt-[18px] pb-1">
          <b className="text-base">{entrada ? 'Jogar na caixa de entrada' : 'Novo material'}</b>
          <button type="button" onClick={onFechar} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3.5 px-5 py-3.5">
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="flex gap-2">
            {TIPOS.map(({ id, nome, icone: Icone }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTipo(id)}
                className={cn('flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-[13px] font-medium', tipo === id ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted')}
              >
                <Icone size={15} strokeWidth={1.75} /> {nome}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-titulo">Título</Label>
            <Input id="mt-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === 'arquivo' ? 'Usa o nome do arquivo se ficar vazio' : 'Resumo da aula 8'} />
          </div>
          {tipo === 'link' && (
            <div className="space-y-1.5">
              <Label htmlFor="mt-url">Endereço</Label>
              <Input id="mt-url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
            </div>
          )}
          {tipo === 'anotacao' && (
            <div className="space-y-1.5">
              <Label htmlFor="mt-texto">Texto</Label>
              <textarea id="mt-texto" rows={5} value={conteudo} onChange={(e) => setConteudo(e.target.value)} className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary" />
            </div>
          )}
          {tipo === 'arquivo' && (
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground hover:border-primary">
              <FileUp size={20} strokeWidth={1.75} className="text-primary" />
              {arquivo ? <b className="text-foreground">{arquivo.name}</b> : 'Clique para escolher (PDF, slides, imagem · até 25 MB)'}
              <input type="file" className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              {progresso > 0 && (
                <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <span className="block h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
                </span>
              )}
            </label>
          )}
          {!disciplinaId && (
            <div className="space-y-1.5">
              <Label htmlFor="mt-disc">Matéria{entrada ? ' (opcional, o Archie sugere depois)' : ''}</Label>
              <select id="mt-disc" value={disc} onChange={(e) => setDisc(e.target.value)} className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm">
                <option value="">{entrada ? 'Deixar na caixa de entrada' : 'Sem matéria'}</option>
                {turmas.map((t) => (
                  <option key={t.id} value={t.disciplina_id}>
                    {t.disciplina.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {turma && (
            <label className="flex items-center gap-2.5 text-[13px]">
              <input type="checkbox" className="size-4 accent-primary" checked={compartilhar} onChange={(e) => setCompartilhar(e.target.checked)} />
              Compartilhar com a turma de {turma.disciplina.sigla ?? turma.disciplina.nome}
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="outline" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? (progresso && progresso < 100 ? `Enviando ${progresso}%` : 'Salvando…') : 'Salvar'}
          </Button>
        </div>
      </form>
    </>
  )
}
