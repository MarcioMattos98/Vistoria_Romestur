/** Erro com mensagem já pensada para o usuário. */
export class AppError extends Error {}

export function friendlyError(e: unknown): string {
  if (e instanceof AppError) return e.message;
  const name = (e as { name?: string } | null)?.name;
  const msg = e instanceof Error ? e.message : String(e);
  if (name === 'QuotaExceededError' || /quota/i.test(msg)) {
    return 'Espaço de armazenamento insuficiente no aparelho. Exporte um backup e exclua vistorias antigas, ou libere espaço.';
  }
  if (name === 'InvalidStateError' || name === 'UnknownError' || name === 'SecurityError') {
    return 'Não foi possível acessar o armazenamento do navegador. Feche outras abas do app e evite a navegação privada.';
  }
  return msg || 'Erro desconhecido.';
}
