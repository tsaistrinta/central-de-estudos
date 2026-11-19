import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileUp, Link2, ShieldCheck, X } from 'lucide-react'
import { enviarAoAcervo } from '@/api/acervo'
import { enviarArquivo } from '@/api/espaco'
import { mensagemDeErro } from '@/api/auth'
import { Aviso } from '@/components/auth/AuthUI'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { ROTULO_TIPO_ACERVO, periodoAtual } from '@/lib/acervo'
import { cn } from '@/lib/utils'
import type { TipoAcervo } from '@/types'

// Tipos que o Archie consegue verificar; o resto é recusado antes mesmo de enviar.
const ACEITOS = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx,.xlsx,.txt,.md'
const EXTENSOES = /\.(pdf|png|jpe?g|webp|docx|pptx|xlsx|txt|md)$/i

export default function NovoItemAcervo({ disciplinaId, disciplinaNome, onFechar }: { disciplinaId: string; disciplinaNome: string; onFechar: () => void }) {
  const qc = useQueryClient()
  const [forma, setForma] = useState<'arquivo' | 'link'>('arquivo')
  const [tipo, setTipo] = useState<TipoAcervo>('resumo')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [periodo, setPeriodo] = useState(periodoAtual())
  const [link, setLink] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [declaro, setDeclaro] = useState(false)
  const [progresso, setProgresso] = useState(0)
  const [erro, setErro] = useState('')

  const salvar = useMutation({
    mutationFn: async () => {
      if (titulo.trim().length < 3) throw new Error('Dê um título com pelo menos 3 letras.')
      if (!declaro) throw new Error('Confirme a declaração para enviar.')
      let arq: { chave: string } | null = null
      if (forma === 'arquivo') {
        if (!arquivo) throw new Error('Escolha um arquivo.')
        if (!EXTENSOES.test(arquivo.name)) throw new Error('Tipo de arquivo não aceito no acervo. Use PDF, imagem, Word, PowerPoint, Excel ou texto.')
        if (arquivo.size > 25 * 1024 * 1024) throw new Error('O arquivo passa de 25 MB.')
        arq = await enviarArquivo(arquivo, setProgresso)
      } else if (!/^https:\/\//i.test(link.trim())) {
        throw new Error('O link precisa começar com https://')
      }
      return enviarAoAcervo({
        disciplina_id: disciplinaId,
        tipo,
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        periodo_origem: periodo.trim() || null,
        link_url: forma === 'link' ? link.trim() : null,
        arquivo_chave: arq?.chave ?? null,
        arquivo_nome: arquivo?.name ?? null,
        arquivo_tamanho: arquivo?.size ?? null,
        arquivo_mime: arquivo?.type || null,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['acervo', disciplinaId] })
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
      <form onSubmit={aoEnviar} className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100vh-48px)] w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-card shadow-[var(--sombra-pop)]">
        <div className="flex items-center justify-between px-5 pt-[18px] pb-1">
          <b className="text-base">Compartilhar no acervo de {disciplinaNome}</b>
          <button type="button" onClick={onFechar} className="text-muted-foreground hover:text-foreground" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-col gap-3.5 overflow-y-auto px-5 py-3.5">
          <p className="flex gap-2 rounded-md bg-accent px-3 py-2 text-xs text-accent-foreground">
            <ShieldCheck size={15} strokeWidth={1.75} className="shrink-0" />
            O acervo fica para as próximas turmas. Todo envio é verificado pelo Archie antes de aparecer. Envios impróprios ficam retidos para revisão do administrador, com o seu nome.
          </p>
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <div className="flex gap-2">
            {(
              [
                ['arquivo', 'Arquivo', FileUp],
                ['link', 'Link', Link2],
              ] as const
            ).map(([id, nome, Icone]) => (
              <button key={id} type="button" onClick={() => setForma(id)} className={cn('flex h-9 flex-1 items-center justify-center gap-2 rounded-md border text-[13px] font-medium', forma === id ? 'border-primary bg-accent text-accent-foreground' : 'border-border hover:bg-muted')}>
                <Icone size={15} strokeWidth={1.75} /> {nome}
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="ac-tipo">O que é</Label>
              <select id="ac-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoAcervo)} className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm">
                {Object.entries(ROTULO_TIPO_ACERVO).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-periodo">Semestre</Label>
              <Input id="ac-periodo" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="2026/2" maxLength={7} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-titulo">Título</Label>
            <Input id="ac-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} placeholder="P1 de 2026/1 com resolução" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-desc">Descrição (opcional)</Label>
            <textarea id="ac-desc" rows={3} maxLength={1000} value={descricao} onChange={(e) => setDescricao(e.target.value)} className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-primary" placeholder="O que tem, de qual professor, para que serve" />
          </div>
          {forma === 'link' ? (
            <div className="space-y-1.5">
              <Label htmlFor="ac-link">Endereço</Label>
              <Input id="ac-link" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-background px-4 py-5 text-center text-sm text-muted-foreground hover:border-primary">
              <FileUp size={20} strokeWidth={1.75} className="text-primary" />
              {arquivo ? <b className="text-foreground">{arquivo.name}</b> : 'PDF, imagem, Word, PowerPoint, Excel ou texto · até 25 MB'}
              <input type="file" accept={ACEITOS} className="hidden" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
              {progresso > 0 && (
                <span className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <span className="block h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
                </span>
              )}
            </label>
          )}
          <label className="flex items-start gap-2.5 text-[12.5px]">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} />
            <span>Declaro que posso compartilhar este material, que ele é de uso acadêmico e que não tem dados pessoais de outras pessoas (CPF, RA, telefone, endereço).</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? 'Enviando…' : 'Enviar para análise'}</Button>
        </div>
      </form>
    </>
  )
}
