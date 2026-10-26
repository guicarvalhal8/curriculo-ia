import { lerPerfil } from "@/lib/dados";
import { buscarDescricao } from "@/lib/descricaoVaga";
import { gerarCurriculo } from "@/lib/gerar";

export async function POST(request: Request) {
  const { titulo, descricao, link } = (await request.json()) as { titulo?: string; descricao?: string; link?: string };
  if (!titulo?.trim()) return Response.json({ erro: "Escolha ou digite uma vaga." }, { status: 400 });
  try {
    const perfil = await lerPerfil();
    // Vagas antigas do vagas-bot vêm sem descrição: busca no anúncio antes de gerar.
    const texto = descricao?.trim() || (link ? await buscarDescricao(link) : "");
    const resposta = await gerarCurriculo(perfil, { titulo, descricao: texto });
    if (!texto) {
      resposta.curriculo.pendencias.unshift(
        link
          ? "Não consegui ler a descrição no anúncio, então o currículo foi feito só pelo título. Abra o anúncio (↗), cole a descrição em \"Ou digite uma vaga\" e gere de novo."
          : "Sem a descrição da vaga, as palavras-chave são as mais comuns da área. Cole o anúncio para um currículo mais certeiro.",
      );
    }
    return Response.json({ ...resposta, descricaoUsada: texto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ erro: `Falha ao gerar: ${msg}` }, { status: 500 });
  }
}
