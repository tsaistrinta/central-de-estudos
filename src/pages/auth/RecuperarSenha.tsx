import { Link } from 'react-router-dom'
import AuthStub from './AuthStub'

export default function RecuperarSenha() {
  return (
    <AuthStub titulo="Recuperar senha" descricao="Enviaremos um link para redefinir sua senha." tela="03">
      <Link to="/entrar" className="text-primary hover:underline">Voltar para entrar</Link>
    </AuthStub>
  )
}
