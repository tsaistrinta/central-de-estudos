// POST { chave } → { url }. Só libera se o material com essa chave estiver visível para quem pede (RLS).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { cors, json } from '../_shared/cors.ts'
import { urlAssinada } from '../_shared/r2.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { chave } = (await req.json()) as { chave: string }
  const { data: material } = await supabase.from('materiais').select('id').eq('arquivo_chave_r2', chave).maybeSingle()
  if (!material) return json({ erro: 'Arquivo não encontrado.' }, 404)
  return json({ url: await urlAssinada('GET', chave, 300) })
})
