import { lerPerfil, salvarPerfil } from "@/lib/dados";
import type { Perfil } from "@/lib/tipos";

export async function GET() {
  return Response.json(await lerPerfil());
}

export async function PUT(request: Request) {
  const perfil = (await request.json()) as Perfil;
  if (!perfil?.nome) return Response.json({ erro: "Nome é obrigatório." }, { status: 400 });
  await salvarPerfil(perfil);
  return Response.json({ ok: true });
}
