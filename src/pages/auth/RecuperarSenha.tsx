import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Aviso, CampoCodigo, CampoSenha, MedidorSenha } from '@/components/auth/AuthUI'
import { confirmarCodigo, enviarCodigoDeRecuperacao, mensagemDeErro, redefinirSenha } from '@/api/auth'
import { SENHA_MINIMA } from '@/lib/senha'

type Etapa = 'email' | 'codigo' | 'senha'

// Tela 03 · Recuperar senha, por código de 6 dígitos (sem link).
// O e-mail institucional (Microsoft 365) abre os links sozinho para checar segurança e gasta o link de uso único;
// com o código isso não acontece. Fica fora de RotaPublica: depois do código a pessoa já está com a sessão aberta.
export default function RecuperarSenha() {
  const navegar = useNavigate()
  const [etapa, setEtapa] = useState<Etapa>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const limpo = email.trim().toLowerCase()

  async function tentar(acao: () => Promise<void>) {
    setErro('')
    setEnviando(true)
    try {
      await acao()
    } catch (falha) {
      setErro(mensagemDeErro(falha))
    } finally {
      setEnviando(false)
    }
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (etapa === 'email') {
      tentar(async () => {
        await enviarCodigoDeRecuperacao(limpo)
        setEtapa('codigo')
      })
    } else if (etapa === 'codigo') {
      tentar(async () => {
        await confirmarCodigo(limpo, codigo)
        setEtapa('senha')
      })
    } else {
      if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`)
      if (senha !== confirmacao) return setErro('As senhas não conferem.')
      tentar(async () => {
        await redefinirSenha(senha)
        navegar('/', { replace: true })
      })
    }
  }

  const subtitulo = {
    email: 'Enviaremos um código de 6 dígitos para o seu e-mail.',
    codigo: `Digite o código que enviamos para ${limpo}.`,
    senha: 'Escolha uma senha que você não usa em outros sites.',
  }[etapa]

  const botao = {
    email: enviando ? 'Enviando…' : 'Receber código',
    codigo: enviando ? 'Conferindo…' : 'Confirmar código',
    senha: enviando ? 'Salvando…' : 'Salvar nova senha',
  }[etapa]

  return (
    <div>
      <span className="grid size-11 place-items-center rounded-lg bg-accent text-accent-foreground">
        <KeyRound size={18} strokeWidth={1.75} />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-tight">{etapa === 'senha' ? 'Criar nova senha' : 'Recuperar senha'}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>

      <form onSubmit={aoEnviar} className="mt-5 space-y-4">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}

        {etapa !== 'senha' && (
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail da conta</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              disabled={etapa === 'codigo'}
              icone={<Mail />}
              placeholder="nome.sobrenome@aluno.cps.sp.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        )}

        {etapa === 'codigo' && (
          <div className="space-y-2">
            <Label>Código de 6 dígitos</Label>
            <CampoCodigo valor={codigo} onChange={setCodigo} autoFocus />
            <p className="text-xs text-muted-foreground">
              Confira também o lixo eletrônico. Não chegou?{' '}
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setCodigo('')
                  tentar(() => enviarCodigoDeRecuperacao(limpo))
                }}
              >
                Mandar de novo
              </button>
            </p>
          </div>
        )}

        {etapa === 'senha' && (
          <>
            <div>
              <Label htmlFor="senha" className="mb-1.5 block">
                Nova senha
              </Label>
              <CampoSenha id="senha" autoComplete="new-password" required autoFocus value={senha} onChange={(e) => setSenha(e.target.value)} />
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
          </>
        )}

        <Button type="submit" className="h-10 w-full font-semibold" disabled={enviando || (etapa === 'codigo' && codigo.length < 6)}>
          {botao}
        </Button>
      </form>

      {etapa !== 'senha' && (
        <Link
          to="/entrar"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={15} strokeWidth={1.75} /> Voltar para entrar
        </Link>
      )}
    </div>
  )
}
