import { Link } from 'react-router-dom'
import AuthStub from './AuthStub'

export default function CriarConta() {
  return (
    <AuthStub titulo="Criar conta" descricao="Aceite dos Termos e da Política é obrigatório." tela="02">
      Já tem conta? <Link to="/entrar" className="text-primary hover:underline">Entrar</Link>
    </AuthStub>
  )
}
