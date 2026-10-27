import { Link } from 'react-router-dom'
import ChipLogo from '@/components/ChipLogo'

type Props = { titulo: string }

// Termos de uso e Política de privacidade. O texto definitivo (LGPD) entra no Marco 7.
export default function Legal({ titulo }: Props) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link to="/" className="flex items-center gap-2">
        <ChipLogo />
        <span className="font-semibold">Central de Estudos</span>
      </Link>
      <h1 className="mt-10 text-[28px] font-semibold tracking-tight">{titulo}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Versão preliminar. Seus dados são privados: só você acessa o que cadastra, e pode exportar ou excluir tudo
        a qualquer momento em Configurações → Privacidade e dados. O texto completo será publicado antes do lançamento.
      </p>
    </div>
  )
}
