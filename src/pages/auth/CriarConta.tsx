import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Aviso, BotaoSocial, CampoSenha, Divisor, MedidorSenha } from '@/components/auth/AuthUI'
import { criarConta, entrarComProvedor, mensagemDeErro } from '@/api/auth'
import { SENHA_MINIMA } from '@/lib/senha'

// Tela 02 · Criar conta. O botão só habilita com o aceite dos Termos e da Política (LGPD).
export default function CriarConta() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [aceite, setAceite] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmarEmail, setConfirmarEmail] = useState(false)

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < SENHA_MINIMA) {
      setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
      return
    }
    setEnviando(true)
    try {
      setConfirmarEmail(await criarConta(nome.trim(), email.trim(), senha))
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  if (confirmarEmail) {
    return (
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Confira seu e-mail</h1>
        <div className="mt-5">
          <Aviso tipo="sucesso">
            <b>Conta criada.</b> Enviamos um link de confirmação para <b>{email}</b>. Abra-o para entrar.
          </Aviso>
        </div>
        <p className="mt-5 text-center text-sm">
          <Link to="/entrar" className="font-semibold text-primary hover:underline">
            Voltar para entrar
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight">Criar conta</h1>
      <p className="mt-1 text-sm text-muted-foreground">Grátis, com 200 MB para seus arquivos.</p>

      <div className="mt-6">
        <BotaoSocial
          provedor="google"
          verbo="Criar"
          onClick={() => entrarComProvedor('google').catch((f) => setErro(mensagemDeErro(f)))}
        />
      </div>

      <div className="my-5">
        <Divisor>ou com e-mail</Divisor>
      </div>

      <form onSubmit={aoEnviar} className="space-y-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            autoComplete="name"
            required
            icone={<User />}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            icone={<Mail />}
            placeholder="voce@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="senha" className="mb-1.5 block">
            Senha
          </Label>
          <CampoSenha
            id="senha"
            autoComplete="new-password"
            required
            minLength={SENHA_MINIMA}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <MedidorSenha senha={senha} />
        </div>
        <label className="flex items-start gap-2.5 text-[13px] leading-snug">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={aceite}
            onChange={(e) => setAceite(e.target.checked)}
          />
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
          {enviando ? 'Criando conta…' : 'Criar conta'}
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
