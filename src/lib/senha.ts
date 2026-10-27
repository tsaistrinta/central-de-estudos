export const SENHA_MINIMA = 8

/** 0–4: comprimento mínimo é obrigatório; maiúsculas+minúsculas, números e símbolos (ou 12+ caracteres) somam. */
export function forcaDaSenha(senha: string) {
  if (senha.length < SENHA_MINIMA) return senha ? 1 : 0
  let pontos = 1
  if (/[a-z]/.test(senha) && /[A-Z]/.test(senha)) pontos++
  if (/\d/.test(senha)) pontos++
  if (/[^A-Za-z0-9]/.test(senha) || senha.length >= 12) pontos++
  return pontos
}
