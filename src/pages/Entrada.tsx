import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Plus, Sparkles } from 'lucide-react'
import { minhasTurmas } from '@/api/academico'
import { atualizarMaterial, listarMateriais } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto, Vazio } from '@/components/foco/Base'
import { Button } from '@/components/ui/button'
import ItemMaterial from '@/components/espaco/ItemMaterial'
import NovoMaterial from '@/components/espaco/NovoMaterial'
import { entenderFrase } from '@/lib/frase'
import type { Material, MinhaTurma } from '@/types'

// Tela 04 · Caixa de entrada: joga aqui sem pensar; depois escolhe a matéria (a Yara sugere na Fase 6).
function Classificar({ m, turmas }: { m: Material; turmas: MinhaTurma[] }) {
  const qc = useQueryClient()
  const sugestao = entenderFrase(`${m.titulo} ${m.conteudo ?? ''}`, turmas.map((t) => t.disciplina)).disciplinaId
  const [disc, setDisc] = useState(sugestao ?? '')
  const mover = useMutation({
    mutationFn: () => atualizarMaterial(m.id, { disciplina_id: disc, na_entrada: false }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['materiais'] }),
  })
  return (
    <div className="ml-11 flex flex-wrap items-center gap-2">
      {sugestao && (
        <span className="inline-flex items-center gap-1 text-xs text-primary">
          <Sparkles size={12} /> Parece ser de {turmas.find((t) => t.disciplina_id === sugestao)?.disciplina.sigla}
        </span>
      )}
      <select value={disc} onChange={(e) => setDisc(e.target.value)} className="h-8 rounded-md border border-border bg-card px-2 text-[13px]">
        <option value="">Escolha a matéria</option>
        {turmas.map((t) => (
          <option key={t.id} value={t.disciplina_id}>
            {t.disciplina.nome}
          </option>
        ))}
      </select>
      <Button size="sm" disabled={!disc || mover.isPending} onClick={() => mover.mutate()}>
        Mover para a matéria
      </Button>
    </div>
  )
}

export default function Entrada() {
  const [novo, setNovo] = useState(false)
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const itens = useQuery({ queryKey: ['materiais', 'entrada'], queryFn: () => listarMateriais({ entrada: true }) })

  return (
    <div className="space-y-4">
      <Cabecalho
        titulo="Caixa de entrada"
        descricao="Foto do quadro, PDF, link ou anotação. Jogue aqui e organize depois."
        acoes={
          <Button onClick={() => setNovo(true)}>
            <Plus /> Adicionar
          </Button>
        }
      />
      <Cartao>
        {itens.isLoading ? (
          <Esqueleto className="pt-4" />
        ) : !itens.data?.length ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <Inbox size={26} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="text-sm font-medium">Caixa vazia</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">Tudo organizado. O que chegar por aqui (e, na Fase 6, por e-mail encaminhado) aparece nesta lista.</p>
          </div>
        ) : (
          <ul>
            {itens.data.map((m) => (
              <ItemMaterial key={m.id} m={m} rodape={<Classificar m={m} turmas={turmas.data ?? []} />} />
            ))}
          </ul>
        )}
      </Cartao>
      {!itens.data?.length && !itens.isLoading && <Vazio>Dica: na agenda, aperte N para criar um evento escrevendo uma frase.</Vazio>}
      {novo && <NovoMaterial turmas={turmas.data ?? []} entrada onFechar={() => setNovo(false)} />}
    </div>
  )
}
