import { Link } from 'react-router-dom'
import AuthStub from './AuthStub'

export default function BoasVindas() {
  return (
    <AuthStub titulo="Vamos montar seu espaço" descricao="Curso → Semestre → Matérias, em 3 passos." tela="04">
      <Link to="/" className="text-primary hover:underline">Pular</Link>
    </AuthStub>
  )
}
