import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Aviso } from '@/components/auth/AuthUI'
import { enviarLinkDeRecuperacao, mensagemDeErro } from '@/api/auth'

// Tela 03 · Recuperar senha. O link leva a /redefinir-senha (fluxo de reset do Supabase Auth).
export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await enviarLinkDeRecuperacao(email.trim())
      setEnviado(true)
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div>
      <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
        <KeyRound size={18} strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Recuperar senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enviaremos um link para você criar uma nova senha.</p>

      <form onSubmit={aoEnviar} className="mt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail da conta</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            icone={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {enviado ? (
          <Aviso tipo="sucesso">
            <b>Link enviado.</b> Confira a caixa de entrada e o spam. O link vale por 1 hora.
          </Aviso>
        ) : (
          <Button type="submit" className="h-10 w-full font-semibold" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Enviar link'}
          </Button>
        )}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </form>

      <Link
        to="/entrar"
        className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> Voltar para entrar
      </Link>
    </div>
  )
}
