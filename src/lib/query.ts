import { QueryClient } from '@tanstack/react-query'

// Cache de 1 min: trocar de semana na agenda ou voltar a uma tela é instantâneo.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, refetchOnWindowFocus: true, retry: 1 },
  },
})
