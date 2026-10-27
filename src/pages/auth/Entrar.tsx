import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Aviso, BotaoSocial, CampoSenha, Divisor, ErroDeCampo } from '@/components/auth/AuthUI'
import { entrarComEmail, entrarComProvedor, mensagemDeErro, type ProvedorSocial } from '@/api/auth'

// Tela 01 · Entrar. O redirecionamento pós-login fica com <RotaPublica>, que reage à nova sessão.
export default function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroCredencial, setErroCredencial] = useState('')
  const [erroGeral, setErroGeral] = useState('')

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErroCredencial('')
    setErroGeral('')
    setEnviando(true)
    try {
      await entrarComEmail(email.trim(), senha)
    } catch (erro) {
      const codigo = (erro as { code?: string }).code
      if (codigo === 'invalid_credentials') setErroCredencial(mensagemDeErro(erro))
      else setErroGeral(mensagemDeErro(erro))
      setEnviando(false)
    }
  }

  async function aoEntrarCom(provedor: ProvedorSocial) {
    setErroGeral('')
    try {
      await entrarComProvedor(provedor)
    } catch (erro) {
      setErroGeral(mensagemDeErro(erro))
    }
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Boas-vindas de volta. Continue de onde parou.</p>

      <div className="mt-6 space-y-3">
        <BotaoSocial provedor="google" verbo="Continuar" onClick={() => aoEntrarCom('google')} />
        <BotaoSocial provedor="azure" verbo="Continuar" onClick={() => aoEntrarCom('azure')} />
      </div>

      <div className="my-5">
        <Divisor>ou com e-mail</Divisor>
      </div>

      <form onSubmit={aoEnviar} className="space-y-4" noValidate={false}>
        {erroGeral && <Aviso tipo="erro">{erroGeral}</Aviso>}
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
          <div className="mb-1.5 flex items-center justify-between">
            <Label htmlFor="senha">Senha</Label>
            <Link to="/recuperar-senha" className="text-[13px] text-primary hover:underline">
              Esqueci minha senha
            </Link>
          </div>
          <CampoSenha
            id="senha"
            autoComplete="current-password"
            required
            value={senha}
            aria-invalid={!!erroCredencial}
            onChange={(e) => setSenha(e.target.value)}
          />
          {erroCredencial && <ErroDeCampo>{erroCredencial}</ErroDeCampo>}
        </div>
        <Button type="submit" className="h-10 w-full font-semibold" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link to="/criar-conta" className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
