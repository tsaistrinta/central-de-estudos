import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AuthLayout from './components/AuthLayout'
import Entrar from './pages/auth/Entrar'
import CriarConta from './pages/auth/CriarConta'
import RecuperarSenha from './pages/auth/RecuperarSenha'
import BoasVindas from './pages/auth/BoasVindas'
import Dashboard from './pages/Dashboard'
import Cursos from './pages/Cursos'
import Curso from './pages/Curso'
import Semestres from './pages/Semestres'
import Semestre from './pages/Semestre'
import Materia from './pages/Materia'
import Materiais from './pages/Materiais'
import Documentos from './pages/Documentos'
import Documento from './pages/Documento'
import Grafo from './pages/Grafo'
import Importar from './pages/Importar'
import Agenda from './pages/Agenda'
import Biblioteca from './pages/Biblioteca'
import Revisar from './pages/Revisar'
import Configuracoes from './pages/Configuracoes'
import Planos from './pages/Planos'
import NaoEncontrada from './pages/NaoEncontrada'

// Rotas alvo da identidade Foco (CLAUDE.md, seção 2.2). A proteção por login entra no Marco 2.
export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="entrar" element={<Entrar />} />
        <Route path="criar-conta" element={<CriarConta />} />
        <Route path="recuperar-senha" element={<RecuperarSenha />} />
        <Route path="boas-vindas" element={<BoasVindas />} />
      </Route>

      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="cursos" element={<Cursos />} />
        <Route path="cursos/:id" element={<Curso />} />
        <Route path="semestres" element={<Semestres />} />
        <Route path="semestres/:id" element={<Semestre />} />
        <Route path="materias/:id" element={<Materia />} />
        <Route path="materiais" element={<Materiais />} />
        <Route path="documentos" element={<Documentos />} />
        <Route path="documentos/grafo" element={<Grafo />} />
        <Route path="documentos/importar" element={<Importar />} />
        <Route path="documentos/:id" element={<Documento />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="calendario" element={<Navigate to="/agenda" replace />} />
        <Route path="biblioteca" element={<Biblioteca />} />
        <Route path="revisar" element={<Revisar />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="configuracoes/:aba" element={<Configuracoes />} />
        <Route path="planos" element={<Planos />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Route>
    </Routes>
  )
}
