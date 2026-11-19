// POST { nome, tipo, tamanho } → { url, chave }. O navegador envia o arquivo direto para o R2 com PUT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { cors, json } from '../_shared/cors.ts'
import { urlAssinada } from '../_shared/r2.ts'

const LIMITE = 25 * 1024 * 1024

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json({ erro: 'Entre para enviar arquivos.' }, 401)

  const { nome, tamanho } = (await req.json()) as { nome: string; tipo?: string; tamanho: number }
  if (!nome || !tamanho) return json({ erro: 'Arquivo inválido.' }, 400)
  if (tamanho > LIMITE) return json({ erro: 'O arquivo passa de 25 MB.' }, 413)

  const limpo = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').slice(-120)
  const chave = `${data.user.id}/${crypto.randomUUID()}/${limpo}`
  try {
    return json({ url: await urlAssinada('PUT', chave), chave })
  } catch (e) {
    console.error('upload', e)
    return json({ erro: 'Não foi possível preparar o envio.' }, 500)
  }
})
