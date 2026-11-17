import { useMutation, useQueryClient } from '@tanstack/react-query'
import { SmilePlus } from 'lucide-react'
import { useState } from 'react'
import { alternarReacao } from '@/api/comunidade'
import { meuIdSincrono } from '@/lib/identidade'
import { cn } from '@/lib/utils'
import type { Pessoa, Reacao } from '@/types'
import { ListaDePessoas } from './Avatares'

const EMOJIS = ['👍', '🙏', '✅', '❤️', '😂', '👀']

// Um só componente de reações para mural, conversa, dúvidas e materiais.
// Clicar no contador mostra quem reagiu, como nas curtidas.
export default function Reacoes({ alvo, reacoes, pessoas, turmaId, chave }: {
  alvo: Pick<Reacao, 'alvo_tipo' | 'alvo_id'>
  reacoes: Reacao[]
  pessoas: Map<string, Pessoa>
  turmaId?: string
  /** queryKey a invalidar depois de reagir */
  chave: unknown[]
}) {
  const qc = useQueryClient()
  const [escolher, setEscolher] = useState(false)
  const eu = meuIdSincrono()
  const minhas = reacoes.filter((r) => r.alvo_id === alvo.alvo_id)
  const porEmoji = EMOJIS.map((e) => ({ emoji: e, ids: minhas.filter((r) => r.emoji === e).map((r) => r.usuario_id) })).filter((g) => g.ids.length)
  const m = useMutation({ mutationFn: (emoji: string) => alternarReacao(alvo, emoji, turmaId), onSettled: () => qc.invalidateQueries({ queryKey: chave }) })

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {porEmoji.map((g) => (
        <button
          key={g.emoji}
          onClick={() => m.mutate(g.emoji)}
          className={cn(
            'inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]',
            eu && g.ids.includes(eu) ? 'border-primary/30 bg-accent text-accent-foreground' : 'border-border hover:bg-muted',
          )}
        >
          {g.emoji}
          <b className="font-mono font-medium">{g.ids.length}</b>
        </button>
      ))}
      <div className="relative">
        <button onClick={() => setEscolher((v) => !v)} className="grid size-[26px] place-items-center rounded-full border border-border text-muted-foreground hover:bg-muted" aria-label="Reagir">
          <SmilePlus size={14} strokeWidth={1.75} />
        </button>
        {escolher && (
          <div className="absolute bottom-full left-0 z-30 mb-1.5 flex gap-1 rounded-full border border-border bg-popover px-2 py-1 shadow-lg">
            {EMOJIS.map((e) => (
              <button
                key={e}
                className="grid size-7 place-items-center rounded-full text-base hover:bg-muted"
                onClick={() => {
                  m.mutate(e)
                  setEscolher(false)
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
      {porEmoji.length > 0 && (
        <ListaDePessoas
          titulo="Reações"
          pessoas={pessoas}
          grupos={porEmoji.map((g) => ({ rotulo: g.emoji, ids: g.ids, classe: 'bg-muted' }))}
          gatilho={<span className="text-[12px] text-muted-foreground hover:text-foreground">ver quem</span>}
        />
      )}
    </div>
  )
}
