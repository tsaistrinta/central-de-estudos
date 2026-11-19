// Toda informação captada mostra a origem (regra do produto). Utilitários para o link da fonte.

/** Link para abrir a fonte: https no site da Fatec e, em PDF, direto na página certa. */
export function linkDaFonte(url: string, pagina?: number | null): string {
  let link = url.replace(/^http:\/\/(www\.)?fatecid\.com\.br/i, 'https://www.fatecid.com.br')
  if (pagina && /\.pdf($|[?#])/i.test(link) && !link.includes('#')) link += `#page=${pagina}`
  return link
}

/** Nome curto da fonte para mostrar ao aluno ("ADS_NOT.pdf", "site da Fatec"). */
export function nomeDaFonte(url: string): string {
  try {
    const u = new URL(url)
    const arquivo = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '')
    if (/\.(pdf|png|jpe?g|webp)$/i.test(arquivo)) return arquivo
    return /fatecid\.com\.br$/i.test(u.hostname) ? 'site da Fatec' : u.hostname
  } catch {
    return 'fonte'
  }
}
