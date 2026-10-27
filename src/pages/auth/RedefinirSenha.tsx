import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/input'
import { Aviso, CampoSenha, MedidorSenha } from '@/components/auth/AuthUI'
import { mensagemDeErro, redefinirSenha } from '@/api/auth'
import { useAuth } from '@/lib/auth'
import { SENHA_MINIMA } from '@/lib/senha'

// Destino do link de recuperação: o Supabase abre uma sessão temporária e aqui o usuário troca a senha.
export default function RedefinirSenha() {
  const { configurado, carregando, sessao } = useAuth()
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function aoEnviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
    if (senha !== confirmacao) return setErro('As senhas não conferem.')
    setEnviando(true)
    try {
      await redefinirSenha(senha)
      navegar('/', { replace: true })
    } catch (falha) {
      setErro(mensagemDeErro(falha))
      setEnviando(false)
    }
  }

  if (configurado && !carregando && !sessao) {
    return (
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Link inválido ou expirado</h1>
        <p className="mt-1 text-sm text-muted-foreground">Peça um novo link para redefinir sua senha.</p>
        <Link to="/recuperar-senha" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">
          Pedir novo link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
        <KeyRound size={18} strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-tight">Criar nova senha</h1>
      <p className="mt-1 text-sm text-muted-foreground">Escolha uma senha que você não usa em outros sites.</p>

      <form onSubmit={aoEnviar} className="mt-5 space-y-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div>
          <Label htmlFor="senha" className="mb-1.5 block">
            Nova senha
          </Label>
          <CampoSenha id="senha" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
          <MedidorSenha senha={senha} />
        </div>
        <div>
          <Label htmlFor="confirmacao" className="mb-1.5 block">
            Repita a nova senha
          </Label>
          <CampoSenha
            id="confirmacao"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>
        <Button type="submit" className="h-10 w-full font-semibold" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </div>
  )
}
