import { Outlet } from 'react-router-dom'
import { CalendarDays, Folder, GitFork } from 'lucide-react'
import ChipLogo from './ChipLogo'

const destaques = [
  { icone: Folder, titulo: 'Curso, semestre e matéria', texto: 'Materiais, links, anotações e códigos no lugar certo.' },
  { icone: GitFork, titulo: 'Documentos conectados', texto: 'Ligue ideias com [[ ]] e veja tudo no grafo.' },
  { icone: CalendarDays, titulo: 'Prazos e revisão', texto: 'Provas e entregas na agenda, com fila do que falta revisar.' },
]

/** Telas 01–02 (entrar, criar conta): painel escuro à esquerda + formulário à direita. */
export function AuthDividido() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[600px_1fr]">
      <aside className="hidden flex-col bg-foreground px-14 py-12 text-card lg:flex">
        <div className="flex items-center gap-2.5">
          <ChipLogo className="size-7 text-card [&_circle]:fill-foreground [&_path]:stroke-foreground" />
          <span className="text-[17px] font-semibold">Central de Estudos</span>
        </div>
        <div className="my-auto">
          <h1 className="max-w-md text-[40px] leading-[1.12] font-semibold tracking-tight">
            O curso inteiro organizado num lugar só.
          </h1>
          <ul className="mt-12 space-y-6">
            {destaques.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="flex gap-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-card/10">
                  <Icone size={16} strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{titulo}</p>
                  <p className="mt-0.5 text-sm text-card/60">{texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono text-xs text-card/50">Feito por estudantes da Fatec · v1.0</p>
      </aside>

      <main className="grid place-items-center bg-card px-4 py-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <ChipLogo />
            <span className="font-semibold">Central de Estudos</span>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  )
}

/** Telas 03 e redefinir senha: cartão centralizado. */
export function AuthCartao() {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <ChipLogo className="size-7" />
          <span className="text-[17px] font-semibold tracking-tight">Central de Estudos</span>
        </div>
        <div className="rounded-lg border border-border bg-card p-7">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
