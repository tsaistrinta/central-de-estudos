import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CalendarPlus, CornerDownLeft, FileText, FolderPlus, Search, Settings, Shield } from 'lucide-react'
import { minhasTurmas } from '@/api/academico'
import { listarMateriais } from '@/api/espaco'
import { COMUNIDADE, MEU_ESPACO } from '@/lib/navegacao'
import { ABRIR_BUSCA } from '@/lib/busca'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'

type Resultado = { id: string; grupo: string; titulo: string; detalhe?: string; icone: ReactNode; ir: string }

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca global (Ctrl+K ou ⌘K): telas, matérias, seus arquivos e ações rápidas, só com o teclado. */
export default function BuscaGlobal() {
  const [aberta, setAberta] = useState(false)
  const [termo, setTermo] = useState('')
  const [ativo, setAtivo] = useState(0)
  const navegar = useNavigate()
  const { perfil } = useAuth()
  const lista = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setAberta((a) => !a)
      }
    }
    const abrir = () => setAberta(true)
    window.addEventListener('keydown', atalho)
    window.addEventListener(ABRIR_BUSCA, abrir)
    return () => {
      window.removeEventListener('keydown', atalho)
      window.removeEventListener(ABRIR_BUSCA, abrir)
    }
  }, [])

  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas, enabled: aberta })
  const arquivos = useQuery({ queryKey: ['materiais', 'meus'], queryFn: () => listarMateriais({ entrada: false, meus: true }), enabled: aberta })

  const todos = useMemo<Resultado[]>(() => {
    const r: Resultado[] = [
      { id: 'a-evento', grupo: 'Ações', titulo: 'Novo evento na agenda', icone: <CalendarPlus />, ir: '/agenda?novo=1' },
      { id: 'a-arquivo', grupo: 'Ações', titulo: 'Guardar um arquivo', icone: <FolderPlus />, ir: '/arquivos?novo=1' },
      ...[...MEU_ESPACO, ...COMUNIDADE].map((n) => ({ id: `n-${n.to}`, grupo: 'Ir para', titulo: n.label, icone: <n.icon />, ir: n.to })),
      { id: 'n-config', grupo: 'Ir para', titulo: 'Configurações', icone: <Settings />, ir: '/configuracoes/perfil' },
    ]
    if (perfil?.papel === 'admin') r.push({ id: 'n-admin', grupo: 'Ir para', titulo: 'Administração', icone: <Shield />, ir: '/admin/visao' })
    for (const t of turmas.data ?? [])
      r.push({ id: `t-${t.id}`, grupo: 'Matérias', titulo: t.disciplina.nome, detalhe: [t.disciplina.sigla, t.professor_nome].filter(Boolean).join(' · '), icone: <BookOpen />, ir: `/materias/${t.disciplina_id}` })
    const nome = new Map((turmas.data ?? []).map((t) => [t.disciplina_id, t.disciplina.nome]))
    for (const m of arquivos.data ?? [])
      r.push({ id: `m-${m.id}`, grupo: 'Seus arquivos', titulo: m.titulo, detalhe: nome.get(m.disciplina_id ?? '') ?? undefined, icone: <FileText />, ir: m.disciplina_id ? `/materias/${m.disciplina_id}` : '/arquivos' })
    return r
  }, [turmas.data, arquivos.data, perfil?.papel])

  const resultados = useMemo(() => {
    const t = sem(termo.trim())
    const achados = t ? todos.filter((r) => sem(`${r.titulo} ${r.detalhe ?? ''}`).includes(t)) : todos.filter((r) => r.grupo !== 'Seus arquivos')
    return achados.slice(0, 40)
  }, [todos, termo])

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo])

  if (!aberta) return null

  const fechar = () => {
    setAberta(false)
    setTermo('')
    setAtivo(0)
  }
  const escolher = (r?: Resultado) => {
    if (!r) return
    fechar()
    navegar(r.ir)
  }

  let grupoAnterior = ''
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-dark/30 px-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={fechar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca global"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl motion-safe:animate-[surgir_120ms_ease-out]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search size={17} strokeWidth={1.75} className="text-muted-foreground" />
          <input
            autoFocus
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value)
              setAtivo(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') fechar()
              else if (e.key === 'ArrowDown') {
                e.preventDefault()
                setAtivo((a) => Math.min(a + 1, resultados.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setAtivo((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') escolher(resultados[ativo])
            }}
            placeholder="Buscar telas, matérias e arquivos…"
            aria-label="Buscar telas, matérias e arquivos"
            role="combobox"
            aria-expanded="true"
            aria-controls="busca-resultados"
            aria-activedescendant={resultados[ativo] ? `busca-${resultados[ativo].id}` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 font-mono text-[11px] text-muted-foreground">Esc</kbd>
        </div>
        <ul ref={lista} id="busca-resultados" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {!resultados.length && <li className="px-3 py-8 text-center text-sm text-muted-foreground">Nada encontrado para “{termo}”.</li>}
          {resultados.map((r, i) => {
            const cabecalho = r.grupo !== grupoAnterior ? r.grupo : null
            grupoAnterior = r.grupo
            return (
              <li key={r.id} role="presentation">
                {cabecalho && <p className="px-2.5 pt-2.5 pb-1 font-mono text-[10.5px] tracking-wider text-muted-foreground uppercase">{cabecalho}</p>}
                <button
                  id={`busca-${r.id}`}
                  role="option"
                  aria-selected={i === ativo}
                  data-indice={i}
                  onMouseEnter={() => setAtivo(i)}
                  onClick={() => escolher(r)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.75]',
                    i === ativo ? 'bg-accent text-accent-foreground' : 'text-foreground',
                  )}
                >
                  <span className={i === ativo ? 'text-primary' : 'text-muted-foreground'}>{r.icone}</span>
                  <span className="min-w-0 flex-1 truncate">{r.titulo}</span>
                  {r.detalhe && <span className="truncate text-xs text-muted-foreground">{r.detalhe}</span>}
                  {i === ativo && <CornerDownLeft className="text-muted-foreground" />}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-border bg-background px-4 py-2 text-[11px] text-muted-foreground">
          <span><kbd className="font-mono">↑ ↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> abrir</span>
          <span className="ml-auto">Central de Estudos</span>
        </div>
      </div>
    </div>
  )
}
