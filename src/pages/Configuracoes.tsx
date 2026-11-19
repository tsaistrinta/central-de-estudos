import { useState } from 'react'
import { Link, Navigate, NavLink, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Copy, Download, Mail, Trash2 } from 'lucide-react'
import { atualizarPerfil, excluirMinhaConta, exportarMeusDados, mensagemDeErro } from '@/api/auth'
import { modoDemo } from '@/api/base'
import { linkIcs, minhasPreferencias, salvarPreferencias } from '@/api/agenda'
import { listarMateriais, listarRevisao, listarTarefas, minhaFrequencia, minhasNotas } from '@/api/espaco'
import { eventosNoIntervalo } from '@/api/agenda'
import { Cabecalho, Cartao } from '@/components/foco/Base'
import { Aviso } from '@/components/auth/AuthUI'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { MINUTOS_LEMBRETE } from '@/lib/agenda'
import { useAuth } from '@/lib/auth'
import { ROTULO_PAPEL } from '@/lib/pessoas'
import { cn } from '@/lib/utils'

const abas = {
  perfil: 'Perfil',
  agenda: 'Agenda',
  notificacoes: 'Notificações',
  privacidade: 'Privacidade e dados',
} as const
type Aba = keyof typeof abas

function Interruptor({ ligado, onMudar, titulo, descricao }: { ligado: boolean; onMudar: (v: boolean) => void; titulo: string; descricao: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 border-b border-muted py-2.5 last:border-0">
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{descricao}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={ligado} onChange={(e) => onMudar(e.target.checked)} />
      <span className={cn('relative h-[18px] w-8 shrink-0 rounded-full transition-colors', ligado ? 'bg-primary' : 'bg-border')}>
        <span className={cn('absolute top-0.5 size-[14px] rounded-full bg-white shadow transition-all', ligado ? 'left-4' : 'left-0.5')} />
      </span>
    </label>
  )
}

function Perfil() {
  const { perfil, recarregarPerfil } = useAuth()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [ok, setOk] = useState('')
  const [erro, setErro] = useState('')
  const salvar = useMutation({
    mutationFn: (v: Parameters<typeof atualizarPerfil>[1]) => atualizarPerfil(perfil!.id, v),
    onSuccess: async () => {
      setOk('Salvo.')
      await recarregarPerfil()
    },
    onError: (e) => setErro(mensagemDeErro(e)),
  })
  if (!perfil) return null
  return (
    <Cartao titulo="Perfil">
      <div className="max-w-md space-y-4 px-4 pb-4">
        {ok && <Aviso tipo="sucesso">{ok}</Aviso>}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail institucional</Label>
          <Input value={perfil.email} disabled aria-label="E-mail institucional" icone={<Mail />} />
        </div>
        <p className="text-[13px] text-muted-foreground">
          Papel: <b className="text-foreground">{ROTULO_PAPEL[perfil.papel]}</b>
          {perfil.semestre ? ` · ${perfil.semestre}º semestre` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => salvar.mutate({ nome: nome.trim() })} disabled={salvar.isPending || !nome.trim()}>
            Salvar
          </Button>
          {perfil.papel === 'aluno' && (
            <Button variant="outline" disabled={perfil.quer_ser_professor} onClick={() => salvar.mutate({ quer_ser_professor: true })}>
              {perfil.quer_ser_professor ? 'Pedido de professor enviado' : 'Sou professor'}
            </Button>
          )}
        </div>
      </div>
    </Cartao>
  )
}

function Agenda() {
  const qc = useQueryClient()
  const prefs = useQuery({ queryKey: ['agenda-preferencias'], queryFn: minhasPreferencias })
  const [copiado, setCopiado] = useState(false)
  const p = prefs.data
  const mudar = useMutation({
    mutationFn: (v: Parameters<typeof salvarPreferencias>[0]) => salvarPreferencias(v),
    onSettled: () => qc.invalidateQueries({ queryKey: ['agenda-preferencias'] }),
  })
  const link = p ? linkIcs(p.ics_token) : ''
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Cartao titulo="Ver no Outlook, Google ou iPhone">
        <div className="space-y-3 px-4 pb-4">
          <p className="text-[13px] text-muted-foreground">Assine uma vez: tudo que mudar aqui aparece lá sozinho (atualiza a cada poucas horas, conforme o app).</p>
          <div className="flex h-9 items-center gap-2 rounded-md border border-border px-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
            <button
              onClick={() => navigator.clipboard.writeText(link).then(() => setCopiado(true))}
              className="text-primary"
              aria-label="Copiar link"
            >
              <Copy size={15} />
            </button>
          </div>
          {copiado && <p className="text-xs text-success">Link copiado.</p>}
          <div className="flex flex-wrap gap-2">
            <a className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3.5 text-sm font-medium hover:bg-muted" href={`https://outlook.office.com/calendar/addcalendar?url=${encodeURIComponent(link)}&name=Central%20de%20Estudos`} target="_blank" rel="noreferrer">
              <Mail size={15} /> Outlook
            </a>
            <a className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3.5 text-sm font-medium hover:bg-muted" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(link.replace(/^https/, 'webcal'))}`} target="_blank" rel="noreferrer">
              <Calendar size={15} /> Google Agenda
            </a>
            <a className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3.5 text-sm font-medium hover:bg-muted" href={link.replace(/^https/, 'webcal')}>
              <Download size={15} /> iPhone
            </a>
          </div>
          <p className="text-xs text-muted-foreground">Link pessoal e secreto. Não compartilhe.</p>
        </div>
      </Cartao>
      <Cartao titulo="Exibição">
        <div className="px-4 pb-3">
          {p && (
            <>
              <Interruptor ligado={p.mostrar_sugestoes} onMudar={(v) => mudar.mutate({ mostrar_sugestoes: v })} titulo="Sugestões do Archie para estudar" descricao="Blocos listrados nos horários livres antes das provas" />
              <Interruptor ligado={p.mostrar_propostas} onMudar={(v) => mudar.mutate({ mostrar_propostas: v })} titulo="Mostrar propostas não confirmadas" descricao="Com borda tracejada até a turma confirmar" />
              <div className="flex items-center gap-3 py-2.5">
                <span className="flex-1 text-[13.5px] font-medium">Começar o dia às</span>
                <select value={p.hora_inicio} onChange={(e) => mudar.mutate({ hora_inicio: Number(e.target.value) })} className="h-8 rounded-md border border-border bg-card px-2 text-sm">
                  {[6, 7, 8, 9, 10, 12, 14, 17].map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, '0')}:00
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </Cartao>
      <Cartao titulo="Lembretes padrão por tipo">
        <ul className="px-4 pb-3">
          {p &&
            Object.entries(p.lembretes_padrao).map(([tipo, mins]) => (
              <li key={tipo} className="flex justify-between border-b border-muted py-2 text-[13px] capitalize last:border-0">
                <span className="font-medium">{tipo}</span>
                <span className="text-muted-foreground normal-case">{mins.map((m) => MINUTOS_LEMBRETE[m] ?? `${m} min`).join(' · ')}</span>
              </li>
            ))}
        </ul>
      </Cartao>
    </div>
  )
}

function baixarJson(dados: unknown, nome: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

function Privacidade() {
  const navegar = useNavigate()
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [excluindo, setExcluindo] = useState(false)

  async function exportar() {
    setGerando(true)
    setErro('')
    try {
      if (modoDemo) {
        const ano = new Date().getFullYear()
        baixarJson({
          exportado_em: new Date().toISOString(),
          aviso: 'Modo demonstração: dados de exemplo.',
          eventos: await eventosNoIntervalo(new Date(`${ano - 1}-01-01`), new Date(`${ano + 1}-12-31`)),
          materiais: await listarMateriais({}),
          tarefas: await listarTarefas(),
          revisao: await listarRevisao(),
          notas: await minhasNotas(),
          frequencia: await minhaFrequencia(),
        }, 'central-de-estudos-meus-dados.json')
      } else {
        baixarJson(await exportarMeusDados(), 'central-de-estudos-meus-dados.json')
      }
    } catch (e) {
      setErro(mensagemDeErro(e))
    } finally {
      setGerando(false)
    }
  }

  async function excluir() {
    setErro('')
    setExcluindo(true)
    try {
      await excluirMinhaConta(confirmacao)
      navegar('/entrar', { replace: true })
    } catch (e) {
      setErro(mensagemDeErro(e))
      setExcluindo(false)
    }
  }

  return (
    <div className="space-y-4">
      <Cartao titulo="Seus dados">
        <div className="max-w-xl space-y-3 px-4 pb-4 text-[13px] leading-relaxed text-muted-foreground">
          <p>Seus dados pessoais (agenda pessoal, arquivos, tarefas, notas e faltas) só são vistos por você. O que você publica numa turma é visto pelos colegas dela.</p>
          <p>A Central nunca pede nem guarda a senha do SIGA. O Archie roda num servidor próprio: nada vai para IA de terceiros.</p>
          <Button variant="outline" onClick={exportar} disabled={gerando}>
            <Download /> {gerando ? 'Gerando…' : 'Baixar todos os meus dados (JSON)'}
          </Button>
          <p>
            Leia os <Link to="/termos" className="text-primary hover:underline">Termos de uso</Link> e a{' '}
            <Link to="/privacidade" className="text-primary hover:underline">Política de privacidade</Link>.
          </p>
        </div>
      </Cartao>
      <Cartao titulo="Excluir minha conta">
        <div className="max-w-xl space-y-3 px-4 pb-4 text-[13px] leading-relaxed text-muted-foreground">
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          <p>
            Apaga para sempre sua agenda pessoal, seus arquivos privados, tarefas, revisão, notas, faltas e votos. O que você
            publicou para a turma (mensagens, dúvidas, respostas e itens do acervo) continua lá, sem o seu nome, como “Ex-aluno”.
            Não dá para desfazer.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="confirmar-exclusao">Para confirmar, digite EXCLUIR</Label>
              <Input id="confirmar-exclusao" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} autoComplete="off" className="w-48" />
            </div>
            <Button
              variant="destructive"
              disabled={modoDemo || excluindo || confirmacao.trim().toUpperCase() !== 'EXCLUIR'}
              onClick={excluir}
              title={modoDemo ? 'Indisponível no modo demonstração' : undefined}
            >
              <Trash2 /> {excluindo ? 'Excluindo…' : 'Excluir minha conta'}
            </Button>
          </div>
        </div>
      </Cartao>
    </div>
  )
}

function Notificacoes() {
  return (
    <Cartao titulo="Notificações">
      <div className="px-4 pb-4 text-[13px] text-muted-foreground">Avisos no celular (PWA) e por e-mail chegam na Fase 8. Por enquanto, as mudanças aparecem na tela Hoje e na agenda.</div>
    </Cartao>
  )
}

export default function Configuracoes() {
  const { aba } = useParams()
  if (!aba || !(aba in abas)) return <Navigate to="/configuracoes/perfil" replace />
  const atual = aba as Aba
  return (
    <div className="space-y-4">
      <Cabecalho titulo="Configurações" descricao="Perfil, agenda, notificações e privacidade." />
      <div className="flex flex-col gap-5 md:flex-row">
        <nav className="flex w-52 shrink-0 flex-col gap-0.5">
          {Object.entries(abas).map(([chave, label]) => (
            <NavLink
              key={chave}
              to={`/configuracoes/${chave}`}
              className={({ isActive }) => cn('rounded-md px-2.5 py-2 text-sm transition-colors', isActive ? 'bg-accent font-medium text-accent-foreground' : 'hover:bg-muted')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0 flex-1">
          {atual === 'perfil' && <Perfil />}
          {atual === 'agenda' && <Agenda />}
          {atual === 'notificacoes' && <Notificacoes />}
          {atual === 'privacidade' && <Privacidade />}
        </div>
      </div>
    </div>
  )
}
