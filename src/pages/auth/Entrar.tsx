import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Aviso, CampoCodigo, CampoSenha, ErroDeCampo } from '@/components/auth/AuthUI'
import { confirmarCodigo, entrarComEmail, enviarCodigoDeEntrada, mensagemDeErro } from '@/api/auth'

// Tela 01 · Entrar com senha ou com um código no e-mail. O redirecionamento fica com <RotaPublica>.
export default function Entrar() {
  const [modo, setModo] = useState<'senha' | 'codigo' | 'digitar'>('senha')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigo, setCodigo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [erroCredencial, setErroCredencial] = useState('')
  const [erroGeral, setErroGeral] = useState('')

  async function tentar(acao: () => Promise<void>) {
    setErroCredencial('')
    setErroGeral('')
    setEnviando(true)
    try {
      await acao()
    } catch (erro) {
      const c = (erro as { code?: string }).code
      if (c === 'invalid_credentials') setErroCredencial(mensagemDeErro(erro))
      else setErroGeral(mensagemDeErro(erro))
    } finally {
      setEnviando(false)
    }
  }

  const limpo = email.trim().toLowerCase()

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    if (modo === 'senha') tentar(() => entrarComEmail(limpo, senha))
    else if (modo === 'codigo') tentar(async () => {
      await enviarCodigoDeEntrada(limpo)
      setModo('digitar')
    })
    else tentar(() => confirmarCodigo(limpo, codigo))
  }

  return (
    <div>
      <h1 className="text-[28px] font-semibold tracking-tight">Entrar</h1>
      <p className="mt-1 text-sm text-muted-foreground">Boas-vindas de volta. Use seu e-mail da Fatec.</p>

      <form onSubmit={aoEnviar} className="mt-6 space-y-4">
        {erroGeral && <Aviso tipo="erro">{erroGeral}</Aviso>}
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail institucional</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            disabled={modo === 'digitar'}
            icone={<Mail />}
            placeholder="nome.sobrenome@aluno.cps.sp.gov.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {modo === 'senha' && (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="senha">Senha</Label>
              <Link to="/recuperar-senha" className="text-[13px] text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <CampoSenha id="senha" autoComplete="current-password" required value={senha} aria-invalid={!!erroCredencial} onChange={(e) => setSenha(e.target.value)} />
            {erroCredencial && <ErroDeCampo>{erroCredencial}</ErroDeCampo>}
          </div>
        )}

        {modo === 'digitar' && (
          <div className="space-y-2">
            <Label>Código de 6 dígitos</Label>
            <CampoCodigo valor={codigo} onChange={setCodigo} autoFocus />
            <p className="text-xs text-muted-foreground">Enviamos para {limpo}. Confira também o lixo eletrônico.</p>
          </div>
        )}

        <Button type="submit" className="h-10 w-full font-semibold" disabled={enviando || (modo === 'digitar' && codigo.length < 6)}>
          {enviando ? 'Aguarde…' : modo === 'senha' ? 'Entrar' : modo === 'codigo' ? 'Receber código' : 'Entrar com o código'}
        </Button>
      </form>

      <button
        className="mt-4 w-full text-center text-[13px] font-medium text-primary hover:underline"
        onClick={() => {
          setModo(modo === 'senha' ? 'codigo' : 'senha')
          setCodigo('')
          setErroGeral('')
        }}
      >
        {modo === 'senha' ? 'Entrar com um código no e-mail' : 'Entrar com senha'}
      </button>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Não tem conta?{' '}
        <Link to="/criar-conta" className="font-semibold text-primary hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
