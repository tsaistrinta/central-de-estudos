import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Aviso, CampoCodigo, CampoSenha, MedidorSenha } from '@/components/auth/AuthUI'
import { confirmarCodigo, criarConta, mensagemDeErro, reenviarCodigo } from '@/api/auth'
import { dominioPermitido } from '@/api/academico'
import { SENHA_MINIMA } from '@/lib/senha'

// Tela 01 · Criar conta com o e-mail da Fatec + código de 6 dígitos (sem integração com a Microsoft).
export default function CriarConta() {
  const navegar = useNavigate()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [etapa, setEtapa] = useState<'dados' | 'codigo'>('dados')
  const [codigo, setCodigo] = useState('')
  const [reenviado, setReenviado] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    const limpo = email.trim().toLowerCase()
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
    setEnviando(true)
    try {
      if (!(await dominioPermitido(limpo))) {
        setErro('Use seu e-mail institucional da Fatec (@aluno.cps.sp.gov.br).')
        return
      }
      const precisaCodigo = await criarConta(nome.trim(), limpo, senha)
      if (precisaCodigo) setEtapa('codigo')
      else navegar('/boas-vindas', { replace: true })
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  async function aoConfirmar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await confirmarCodigo(email.trim().toLowerCase(), codigo)
      navegar('/boas-vindas', { replace: true })
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  if (etapa === 'codigo') {
    return (
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Confirme seu e-mail</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enviamos um código de 6 dígitos para <b className="text-foreground">{email}</b>. Abra o Outlook da Fatec e digite o
          código aqui. Se não aparecer, confira o lixo eletrônico.
        </p>
        <form onSubmit={aoConfirmar} className="mt-6 space-y-4">
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {reenviado && <Aviso tipo="sucesso">Mandamos um código novo.</Aviso>}
          <CampoCodigo valor={codigo} onChange={setCodigo} autoFocus />
          <Button type="submit" className="h-10 w-full font-semibold" disabled={codigo.length < 6 || enviando}>
            {enviando ? 'Conferindo…' : 'Confirmar e entrar'}
          </Button>
        </form>
        <div className="mt-5 flex justify-between text-sm">
          <button className="text-muted-foreground hover:text-foreground" onClick={() => setEtapa('dados')}>
            Trocar e-mail
          </button>
          <button
            className="font-semibold text-primary hover:underline"
            onClick={() =>
              reenviarCodigo(email.trim().toLowerCase())
                .then(() => setReenviado(true))
                .catch((f) => setErro(mensagemDeErro(f)))
            }
          >
            Reenviar código
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-1 text-sm text-muted-foreground">Com o seu e-mail da Fatec. Leva um minuto.</p>

      <form onSubmit={aoEnviar} className="mt-6 space-y-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input id="nome" autoComplete="name" required icone={<User />} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail institucional</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            icone={<Mail />}
            placeholder="nome.sobrenome@aluno.cps.sp.gov.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Só e-mails da Fatec podem criar conta.</p>
        </div>
        <div>
          <Label htmlFor="senha" className="mb-1.5 block">
            Senha
          </Label>
          <CampoSenha id="senha" autoComplete="new-password" required minLength={SENHA_MINIMA} value={senha} onChange={(e) => setSenha(e.target.value)} />
          <MedidorSenha senha={senha} />
        </div>
        <label className="flex items-start gap-2.5 text-[13px] leading-snug">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={aceite} onChange={(e) => setAceite(e.target.checked)} />
          <span>
            Li e aceito os{' '}
            <Link to="/termos" target="_blank" className="font-semibold text-primary hover:underline">
              Termos de uso
            </Link>{' '}
            e a{' '}
            <Link to="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">
              Política de privacidade
            </Link>
            .
          </span>
        </label>
        <Button type="submit" className="h-10 w-full font-semibold" disabled={!aceite || enviando}>
          {enviando ? 'Enviando código…' : 'Receber código no e-mail'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
