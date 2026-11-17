// URLs pré-assinadas do Cloudflare R2 (compatível com S3). As chaves ficam só nos segredos da função.
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

const conta = Deno.env.get('R2_ACCOUNT_ID')!
const bucket = Deno.env.get('R2_BUCKET') ?? 'central-de-estudos'
const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
})

export async function urlAssinada(metodo: 'PUT' | 'GET', chave: string, segundos = 600) {
  const url = new URL(`https://${conta}.r2.cloudflarestorage.com/${bucket}/${chave.split('/').map(encodeURIComponent).join('/')}`)
  url.searchParams.set('X-Amz-Expires', String(segundos))
  const assinado = await r2.sign(new Request(url, { method: metodo }), { aws: { signQuery: true } })
  return assinado.url
}
