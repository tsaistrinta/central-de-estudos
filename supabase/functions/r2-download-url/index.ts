// POST { chave } → { url }. Só libera se o material (ou item do acervo) com essa chave estiver visível para quem pede (RLS).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { cors, json } from '../_shared/cors.ts'
import { urlAssinada } from '../_shared/r2.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { chave } = (await req.json()) as { chave: string }
  if (!chave) return json({ erro: 'Arquivo inválido.' }, 400)
  const { data: material } = await supabase.from('materiais').select('id').eq('arquivo_chave_r2', chave).maybeSingle()
  const { data: acervo } = material ? { data: null } : await supabase.from('acervo_itens').select('id').eq('arquivo_chave', chave).maybeSingle()
  if (!material && !acervo) return json({ erro: 'Arquivo não encontrado.' }, 404)
  try {
    return json({ url: await urlAssinada('GET', chave, 300) })
  } catch (e) {
    console.error('download', e)
    return json({ erro: 'Não foi possível abrir o arquivo.' }, 500)
  }
})
