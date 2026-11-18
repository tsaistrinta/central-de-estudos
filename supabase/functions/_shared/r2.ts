// URLs pré-assinadas para os arquivos dos materiais.
// Com os segredos R2_* definidos, usa o Cloudflare R2 (compatível com S3).
// Sem eles, usa o Supabase Storage (bucket privado "materiais"), para o app funcionar
// enquanto o R2 não está ativado. A interface é a mesma: o navegador faz PUT/GET na URL.
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const conta = Deno.env.get('R2_ACCOUNT_ID')
const chaveR2 = Deno.env.get('R2_ACCESS_KEY_ID')
const segredoR2 = Deno.env.get('R2_SECRET_ACCESS_KEY')
const bucket = Deno.env.get('R2_BUCKET') ?? 'central-de-estudos'
const BUCKET_STORAGE = 'materiais'

const usarR2 = Boolean(conta && chaveR2 && segredoR2)
const r2 = usarR2
  ? new AwsClient({ accessKeyId: chaveR2!, secretAccessKey: segredoR2!, service: 's3', region: 'auto' })
  : null
const admin = usarR2 ? null : createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

export async function urlAssinada(metodo: 'PUT' | 'GET', chave: string, segundos = 600) {
  if (r2) {
    const url = new URL(`https://${conta}.r2.cloudflarestorage.com/${bucket}/${chave.split('/').map(encodeURIComponent).join('/')}`)
    url.searchParams.set('X-Amz-Expires', String(segundos))
    const assinado = await r2.sign(new Request(url, { method: metodo }), { aws: { signQuery: true } })
    return assinado.url
  }
  const storage = admin!.storage.from(BUCKET_STORAGE)
  if (metodo === 'PUT') {
    const { data, error } = await storage.createSignedUploadUrl(chave)
    if (error) throw error
    return data.signedUrl
  }
  const { data, error } = await storage.createSignedUrl(chave, segundos)
  if (error) throw error
  return data.signedUrl
}
