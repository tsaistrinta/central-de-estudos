import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderOpen, Plus, Search, Sparkles } from 'lucide-react'
import { minhasTurmas } from '@/api/academico'
import { atualizarMaterial, listarMateriais } from '@/api/espaco'
import { Cabecalho, Cartao, Esqueleto } from '@/components/foco/Base'
import { Button } from '@/components/ui/button'
import ItemMaterial from '@/components/espaco/ItemMaterial'
import NovoMaterial from '@/components/espaco/NovoMaterial'
import { entenderFrase } from '@/lib/frase'
import type { Material, MinhaTurma } from '@/types'

// Tela 04 · Meus arquivos (antes "Caixa de entrada"): o repositório pessoal do aluno.
// Em cima, o que ainda não tem matéria; embaixo, tudo o que já está guardado, com filtro e busca.
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
      <select
        value={disc}
        onChange={(e) => setDisc(e.target.value)}
        aria-label="Matéria do arquivo"
        className="h-8 rounded-md border border-border bg-card px-2 text-[13px]"
      >
        <option value="">Escolha a matéria</option>
        {turmas.map((t) => (
          <option key={t.id} value={t.disciplina_id}>
            {t.disciplina.nome}
          </option>
        ))}
      </select>
      <Button size="sm" disabled={!disc || mover.isPending} onClick={() => mover.mutate()}>
        Guardar na matéria
      </Button>
    </div>
  )
}

function semAcento(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export default function MeusArquivos() {
  const [params] = useSearchParams()
  const [novo, setNovo] = useState(() => params.get('novo') === '1')
  const [materia, setMateria] = useState('')
  const [busca, setBusca] = useState('')
  const turmas = useQuery({ queryKey: ['minhas-turmas'], queryFn: minhasTurmas })
  const paraOrganizar = useQuery({ queryKey: ['materiais', 'entrada'], queryFn: () => listarMateriais({ entrada: true }) })
  const guardados = useQuery({ queryKey: ['materiais', 'meus'], queryFn: () => listarMateriais({ entrada: false, meus: true }) })

  const nomeDaMateria = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const t of turmas.data ?? []) mapa.set(t.disciplina_id, t.disciplina.nome)
    return mapa
  }, [turmas.data])

  const filtrados = useMemo(() => {
    const termo = semAcento(busca.trim())
    return (guardados.data ?? []).filter(
      (m) =>
        (!materia || m.disciplina_id === materia) &&
        (!termo || semAcento(`${m.titulo} ${m.conteudo ?? ''} ${nomeDaMateria.get(m.disciplina_id ?? '') ?? ''}`).includes(termo)),
    )
  }, [guardados.data, materia, busca, nomeDaMateria])

  const pendentes = paraOrganizar.data ?? []
  const nadaAinda = !paraOrganizar.isLoading && !guardados.isLoading && !pendentes.length && !guardados.data?.length

  return (
    <div className="space-y-4">
      <Cabecalho
        titulo="Meus arquivos"
        descricao="Seu lugar para guardar PDFs, fotos do quadro, slides, links e anotações. Só você vê."
        acoes={
          <Button onClick={() => setNovo(true)}>
            <Plus /> Adicionar arquivo
          </Button>
        }
      />

      {nadaAinda ? (
        <Cartao>
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <FolderOpen size={26} strokeWidth={1.5} className="text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum arquivo ainda</p>
            <p className="max-w-sm text-[13px] text-muted-foreground">
              Envie o primeiro: pode ser sem matéria, você organiza depois.
            </p>
            <Button className="mt-2" onClick={() => setNovo(true)}>
              <Plus /> Adicionar arquivo
            </Button>
          </div>
        </Cartao>
      ) : (
        <>
          {(paraOrganizar.isLoading || pendentes.length > 0) && (
            <Cartao titulo={`Para organizar${pendentes.length ? ` · ${pendentes.length}` : ''}`}>
              {paraOrganizar.isLoading ? (
                <Esqueleto className="pt-4" />
              ) : (
                <ul>
                  {pendentes.map((m) => (
                    <ItemMaterial key={m.id} m={m} rodape={<Classificar m={m} turmas={turmas.data ?? []} />} />
                  ))}
                </ul>
              )}
            </Cartao>
          )}

          <Cartao titulo="Guardados">
            <div className="flex flex-wrap items-center gap-2 border-b border-muted px-4 py-3">
              <label className="relative min-w-[200px] flex-1">
                <Search size={15} strokeWidth={1.75} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nos seus arquivos"
                  aria-label="Buscar nos seus arquivos"
                  className="h-9 w-full rounded-md border border-border bg-card pr-3 pl-8 text-sm outline-none focus:border-primary focus:ring-[3px] focus:ring-accent"
                />
              </label>
              <select
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                aria-label="Filtrar por matéria"
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
              >
                <option value="">Todas as matérias</option>
                {(turmas.data ?? []).map((t) => (
                  <option key={t.id} value={t.disciplina_id}>
                    {t.disciplina.nome}
                  </option>
                ))}
              </select>
            </div>
            {guardados.isLoading ? (
              <Esqueleto className="pt-4" />
            ) : !filtrados.length ? (
              <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">
                {guardados.data?.length ? 'Nada encontrado com esse filtro.' : 'Os arquivos que você guardar em uma matéria aparecem aqui.'}
              </p>
            ) : (
              <ul>
                {filtrados.map((m) => (
                  <ItemMaterial
                    key={m.id}
                    m={m}
                    rodape={
                      m.disciplina_id && (
                        <p className="ml-11 text-xs text-muted-foreground">{nomeDaMateria.get(m.disciplina_id) ?? 'Matéria'}</p>
                      )
                    }
                  />
                ))}
              </ul>
            )}
          </Cartao>
        </>
      )}

      {novo && <NovoMaterial turmas={turmas.data ?? []} entrada onFechar={() => setNovo(false)} />}
    </div>
  )
}
