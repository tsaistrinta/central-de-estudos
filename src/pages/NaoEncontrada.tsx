import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

export default function NaoEncontrada() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">Página não encontrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">O endereço não existe ou o item foi excluído.</p>
        <Button className="mt-5" onClick={() => history.back()} variant="outline">
          Voltar
        </Button>
        <Link to="/" className="ml-2 inline-flex h-9 items-center rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover">
          Ir para o Início
        </Link>
      </div>
    </div>
  )
}
