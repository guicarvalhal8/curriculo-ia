/**
 * Conversa com o candidatar.py do vagas-bot (ponte_web.py), que já sabe mandar e-mail,
 * preencher formulário e perguntar no Telegram o que não souber.
 */
const PONTE = process.env.PONTE_VAGAS_BOT || "http://127.0.0.1:47614";
const CABECALHO = { "X-Ponte": "curriculo-ia", "Content-Type": "application/json" };

export const SEM_PONTE =
  "O candidatar.py do vagas-bot não está rodando (ou está numa versão antiga, sem a ponte). Reinicie pelo iniciar_candidatar.vbs.";

export type RespostaPonte = { ok: boolean; status: number; dados: Record<string, unknown> };

/** Marcador [X] não pode chegar na empresa. Devolve o primeiro que achar no HTML. */
export function marcadorNoHtml(html: string): string | null {
  const texto = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  return texto.match(/\[[^\]]{1,40}\]/)?.[0] ?? null;
}

async function chamar(caminho: string, init: RequestInit = {}): Promise<RespostaPonte> {
  try {
    const r = await fetch(`${PONTE}${caminho}`, { ...init, headers: CABECALHO, signal: AbortSignal.timeout(10_000) });
    return { ok: r.ok, status: r.status, dados: await r.json() };
  } catch {
    return { ok: false, status: 503, dados: { erro: SEM_PONTE } };
  }
}

export const pedirCandidatura = (link: string, titulo: string, html: string) =>
  chamar("/candidatar", { method: "POST", body: JSON.stringify({ link, titulo, html }) });

export const statusDaCandidatura = (id: string) => chamar(`/status?id=${encodeURIComponent(id)}`);
