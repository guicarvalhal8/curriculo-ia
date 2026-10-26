import { atualizarVagasBot, lerVagasBot } from "@/lib/vagasBot";

export async function GET() {
  try {
    return Response.json(lerVagasBot());
  } catch (e) {
    return Response.json({ erro: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** Atualiza o vagas-bot (git pull) e devolve a lista nova. */
export async function POST() {
  try {
    await atualizarVagasBot();
    return Response.json(lerVagasBot());
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ erro: `Não consegui atualizar as vagas: ${msg}` }, { status: 500 });
  }
}
