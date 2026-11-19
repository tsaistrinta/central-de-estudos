/** Evento da janela que abre a busca global (botão "Buscar" da barra lateral e do celular). */
export const ABRIR_BUSCA = 'central:abrir-busca'

export function abrirBusca() {
  window.dispatchEvent(new Event(ABRIR_BUSCA))
}
