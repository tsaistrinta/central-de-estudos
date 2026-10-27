import { Link } from 'react-router-dom'
import AuthStub from './AuthStub'

export default function Entrar() {
  return (
    <AuthStub titulo="Entrar" descricao="Acesse com Google, Microsoft ou e-mail." tela="01">
      <Link to="/recuperar-senha" className="text-primary hover:underline">Esqueci minha senha</Link>
      <span className="mx-2 text-faint">·</span>
      <Link to="/criar-conta" className="text-primary hover:underline">Criar conta</Link>
    </AuthStub>
  )
}
