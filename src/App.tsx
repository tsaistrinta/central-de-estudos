import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthCartao, AuthDividido } from "./components/AuthLayout";
import { RotaProtegida, RotaPublica } from "./components/RotaProtegida";
import Entrar from "./pages/auth/Entrar";
import CriarConta from "./pages/auth/CriarConta";
import RecuperarSenha from "./pages/auth/RecuperarSenha";
import RedefinirSenha from "./pages/auth/RedefinirSenha";
import Hoje from "./pages/Hoje";
import NaoEncontrada from "./pages/NaoEncontrada";

const Materias = lazy(() => import("./pages/Materias"));
const Materia = lazy(() => import("./pages/Materia"));
const MeusArquivos = lazy(() => import("./pages/MeusArquivos"));
const Tarefas = lazy(() => import("./pages/Tarefas"));
const Revisar = lazy(() => import("./pages/Revisar"));
const Curso = lazy(() => import("./pages/Curso"));
const Unidade = lazy(() => import("./pages/Unidade"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Legal = lazy(() => import("./pages/Legal"));
const BoasVindas = lazy(() => import("./pages/auth/BoasVindas"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Notas = lazy(() => import("./pages/Notas"));
const Turma = lazy(() => import("./pages/Turma"));
const Admin = lazy(() => import("./pages/admin/Admin"));

// Telas carregadas sob demanda: o primeiro acesso baixa só o necessário para Entrar e Hoje.
// Rotas da nova direção (Central para a Fatec, com o Archie). Mockups: telas 01–26.
// Sem .env.local o app roda em modo demonstração: as rotas protegidas ficam abertas.
function CarregandoTela() {
  return (
    <div
      className="grid min-h-dvh place-items-center"
      role="status"
      aria-label="Carregando"
    >
      <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-primary" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<CarregandoTela />}>
      <Routes>
        <Route element={<RotaPublica />}>
          <Route element={<AuthDividido />}>
            <Route path="entrar" element={<Entrar />} />
            <Route path="criar-conta" element={<CriarConta />} />
          </Route>
        </Route>

        {/* Fora de RotaPublica: depois do código de recuperação (ou de um link antigo) a pessoa já está com a sessão aberta. */}
        <Route element={<AuthCartao />}>
          <Route path="recuperar-senha" element={<RecuperarSenha />} />
          <Route path="redefinir-senha" element={<RedefinirSenha />} />
        </Route>
        <Route path="termos" element={<Legal titulo="Termos de uso" />} />
        <Route
          path="privacidade"
          element={<Legal titulo="Política de privacidade" />}
        />

        <Route element={<RotaProtegida />}>
          <Route path="boas-vindas" element={<BoasVindas />} />
          <Route element={<Layout />}>
            {/* Meu espaço · privado */}
            <Route index element={<Hoje />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="materias" element={<Materias />} />
            <Route path="materias/:id" element={<Materia />} />
            <Route path="arquivos" element={<MeusArquivos />} />
            <Route
              path="entrada"
              element={<Navigate to="/arquivos" replace />}
            />
            <Route path="tarefas" element={<Tarefas />} />
            <Route path="revisao" element={<Revisar />} />
            <Route path="notas" element={<Notas />} />

            {/* Comunidade */}
            <Route path="turma" element={<Turma />} />
            <Route path="turmas/:id" element={<Turma />} />
            <Route path="curso" element={<Curso />} />
            <Route path="unidade" element={<Unidade />} />

            {/* Administração (papel admin, Fase 7) */}
            <Route
              path="admin"
              element={<Navigate to="/admin/visao" replace />}
            />
            <Route path="admin/:aba" element={<Admin />} />

            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="configuracoes/:aba" element={<Configuracoes />} />

            {/* Endereços antigos */}
            <Route
              path="calendario"
              element={<Navigate to="/agenda" replace />}
            />
            <Route
              path="revisar"
              element={<Navigate to="/revisao" replace />}
            />
            <Route
              path="materiais"
              element={<Navigate to="/materias" replace />}
            />

            <Route path="*" element={<NaoEncontrada />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
