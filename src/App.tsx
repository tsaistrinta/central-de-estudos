import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import { AuthCartao, AuthDividido } from './components/AuthLayout'
import { RotaProtegida, RotaPublica } from './components/RotaProtegida'
import Entrar from './pages/auth/Entrar'
import CriarConta from './pages/auth/CriarConta'
import RecuperarSenha from './pages/auth/RecuperarSenha'
import RedefinirSenha from './pages/auth/RedefinirSenha'
import BoasVindas from './pages/auth/BoasVindas'
import Legal from './pages/Legal'
import Hoje from './pages/Hoje'
import Agenda from './pages/Agenda'
import Materias from './pages/Materias'
import Materia from './pages/Materia'
import Entrada from './pages/Entrada'
import Tarefas from './pages/Tarefas'
import Revisar from './pages/Revisar'
import Notas from './pages/Notas'
import Turma from './pages/Turma'
import Curso from './pages/Curso'
import Unidade from './pages/Unidade'
import Admin from './pages/admin/Admin'
import Configuracoes from './pages/Configuracoes'
import NaoEncontrada from './pages/NaoEncontrada'

// Rotas da nova direção (Central para a Fatec, com a Yara). Mockups: telas 01–26.
// Sem .env.local o app roda em modo demonstração: as rotas protegidas ficam abertas.
export default function App() {
  return (
    <Routes>
      <Route element={<RotaPublica />}>
        <Route element={<AuthDividido />}>
          <Route path="entrar" element={<Entrar />} />
          <Route path="criar-conta" element={<CriarConta />} />
        </Route>
        <Route element={<AuthCartao />}>
          <Route path="recuperar-senha" element={<RecuperarSenha />} />
        </Route>
      </Route>

      {/* Fora de RotaPublica: o link de recuperação chega com uma sessão aberta. */}
      <Route element={<AuthCartao />}>
        <Route path="redefinir-senha" element={<RedefinirSenha />} />
      </Route>
      <Route path="termos" element={<Legal titulo="Termos de uso" />} />
      <Route path="privacidade" element={<Legal titulo="Política de privacidade" />} />

      <Route element={<RotaProtegida />}>
        <Route path="boas-vindas" element={<BoasVindas />} />
        <Route element={<Layout />}>
          {/* Meu espaço · privado */}
          <Route index element={<Hoje />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="materias" element={<Materias />} />
          <Route path="materias/:id" element={<Materia />} />
          <Route path="entrada" element={<Entrada />} />
          <Route path="tarefas" element={<Tarefas />} />
          <Route path="revisao" element={<Revisar />} />
          <Route path="notas" element={<Notas />} />

          {/* Comunidade */}
          <Route path="turma" element={<Turma />} />
          <Route path="turmas/:id" element={<Turma />} />
          <Route path="curso" element={<Curso />} />
          <Route path="unidade" element={<Unidade />} />

          {/* Administração (papel admin, Fase 7) */}
          <Route path="admin" element={<Navigate to="/admin/visao" replace />} />
          <Route path="admin/:aba" element={<Admin />} />

          <Route path="configuracoes" element={<Configuracoes />} />
          <Route path="configuracoes/:aba" element={<Configuracoes />} />

          {/* Endereços antigos */}
          <Route path="calendario" element={<Navigate to="/agenda" replace />} />
          <Route path="revisar" element={<Navigate to="/revisao" replace />} />
          <Route path="materiais" element={<Navigate to="/materias" replace />} />

          <Route path="*" element={<NaoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  )
}
