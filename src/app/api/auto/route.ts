import { estadoAuto, rodarCiclo } from "@/lib/auto";

export async function GET() {
  return Response.json(await estadoAuto());
}

/** "Rodar agora" da tela: não espera terminar, porque gerar e enviar várias vagas leva minutos. */
export async function POST() {
  rodarCiclo().catch((e) => console.error("[auto] rodada falhou:", e));
  return Response.json(await estadoAuto(), { status: 202 });
}
