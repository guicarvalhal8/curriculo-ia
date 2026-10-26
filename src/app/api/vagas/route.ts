import { lerVagas, salvarVagas } from "@/lib/dados";
import type { Vaga } from "@/lib/tipos";

export async function GET() {
  return Response.json(await lerVagas());
}

export async function PUT(request: Request) {
  const vagas = (await request.json()) as Vaga[];
  if (!Array.isArray(vagas)) return Response.json({ erro: "Lista inválida." }, { status: 400 });
  await salvarVagas(vagas.filter((v) => v.titulo?.trim()));
  return Response.json({ ok: true });
}
