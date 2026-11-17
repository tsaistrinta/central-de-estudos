import { useEffect, useState } from 'react'

/** Hora atual que se atualiza a cada minuto (mantém os componentes puros). */
export function useAgora(intervaloMs = 60_000) {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), intervaloMs)
    return () => clearInterval(t)
  }, [intervaloMs])
  return agora
}
