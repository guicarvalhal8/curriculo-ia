import { marcadorNoHtml, pedirCandidatura, statusDaCandidatura } from "@/lib/ponte";

export async function POST(request: Request) {
  const { link, titulo, html } = (await request.json()) as { link?: string; titulo?: string; html?: string };
  if (!link || !titulo || !html) return Response.json({ erro: "Faltou vaga ou currículo." }, { status: 400 });
  // A tela já bloqueia marcador; aqui é a segunda trava.
  const marcador = marcadorNoHtml(html);
  if (marcador) {
    return Response.json({ erro: `O currículo ainda tem o marcador ${marcador}. Preencha ou apague antes de enviar.` }, { status: 400 });
  }
  const r = await pedirCandidatura(link, titulo, html);
  return Response.json(r.dados, { status: r.status });
}

export async function GET(request: Request) {
  const r = await statusDaCandidatura(new URL(request.url).searchParams.get("id") ?? "");
  return Response.json(r.dados, { status: r.status });
}
