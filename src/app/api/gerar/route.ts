import { lerPerfil } from "@/lib/dados";
import { gerarCurriculo } from "@/lib/gerar";

export async function POST(request: Request) {
  const { titulo, descricao } = (await request.json()) as { titulo?: string; descricao?: string };
  if (!titulo?.trim()) return Response.json({ erro: "Escolha ou digite uma vaga." }, { status: 400 });
  try {
    const perfil = await lerPerfil();
    return Response.json(await gerarCurriculo(perfil, { titulo, descricao: descricao ?? "" }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ erro: `Falha ao gerar: ${msg}` }, { status: 500 });
  }
}
