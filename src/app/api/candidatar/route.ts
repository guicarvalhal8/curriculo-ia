/**
 * Repassa a candidatura para o candidatar.py do vagas-bot (ponte_web.py), que já sabe
 * mandar e-mail, preencher formulário e perguntar no Telegram o que não souber.
 */
const PONTE = process.env.PONTE_VAGAS_BOT || "http://127.0.0.1:47614";
const CABECALHO = { "X-Ponte": "curriculo-ia", "Content-Type": "application/json" };

const SEM_PONTE =
  "O candidatar.py do vagas-bot não está rodando (ou está numa versão antiga, sem a ponte). Reinicie pelo iniciar_candidatar.vbs.";

export async function POST(request: Request) {
  const { link, titulo, html } = (await request.json()) as { link?: string; titulo?: string; html?: string };
  if (!link || !titulo || !html) return Response.json({ erro: "Faltou vaga ou currículo." }, { status: 400 });
  // Marcador [X] não pode chegar na empresa: a tela já bloqueia, aqui é a segunda trava.
  const texto = html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  const marcador = texto.match(/\[[^\]]{1,40}\]/);
  if (marcador) {
    return Response.json({ erro: `O currículo ainda tem o marcador ${marcador[0]}. Preencha ou apague antes de enviar.` }, { status: 400 });
  }
  try {
    const r = await fetch(`${PONTE}/candidatar`, {
      method: "POST",
      headers: CABECALHO,
      body: JSON.stringify({ link, titulo, html }),
      signal: AbortSignal.timeout(10_000),
    });
    return Response.json(await r.json(), { status: r.status });
  } catch {
    return Response.json({ erro: SEM_PONTE }, { status: 503 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  try {
    const r = await fetch(`${PONTE}/status?id=${encodeURIComponent(id)}`, {
      headers: CABECALHO,
      signal: AbortSignal.timeout(10_000),
    });
    return Response.json(await r.json(), { status: r.status });
  } catch {
    return Response.json({ erro: SEM_PONTE }, { status: 503 });
  }
}
