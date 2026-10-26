/**
 * Candidatura automática: o vagas-bot raspa, este módulo gera o currículo de cada vaga nova
 * e manda o candidatar.py se candidatar. Liga com AUTO_CANDIDATAR=1 no .env.local.
 *
 * Decisões do Guilherme (2026-10-26): sem número inventado e sem marcador no texto;
 * só vagas que saem sozinhas (LinkedIn e Gupy ficam para a tela); sem limite diário.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { lerPerfil } from "./dados";
import { buscarDescricao } from "./descricaoVaga";
import { folhaEmHtml } from "./folhaHtml";
import { gerarCurriculo } from "./gerar";
import { marcadorNoHtml, pedirCandidatura, statusDaCandidatura } from "./ponte";
import { tituloLimpo } from "./texto";
import type { EstadoAuto, ItemAuto, RespostaGerar, VagaBot } from "./tipos";
import { atualizarVagasBot, lerVagasBot } from "./vagasBot";

const ARQUIVO = path.join(process.cwd(), "data", "auto.json");
/** Precisam de você: o LinkedIn não é preenchido por regra e a Gupy pede login. */
const FICA_PARA_A_TELA = /linkedin\.|gupy\.io/i;
const EM_ANDAMENTO: ItemAuto["estado"][] = ["fila", "candidatando"];

export const autoLigado = () => process.env.AUTO_CANDIDATAR === "1";

/** Hora no formato do vista_em do SQLite (UTC), para comparar direto. */
const agoraSqlite = () => new Date().toISOString().replace("T", " ").slice(0, 19);

type Salvo = Omit<EstadoAuto, "ligado" | "rodando">;

async function ler(): Promise<Salvo> {
  if (!existsSync(ARQUIVO)) return { inicio: "", itens: [] };
  // Arquivo editado à mão no Windows pode vir com BOM
  return JSON.parse((await readFile(ARQUIVO, "utf8")).replace(/^\uFEFF/, ""));
}

async function gravar(s: Salvo) {
  await writeFile(ARQUIVO, JSON.stringify(s, null, 2) + "\n", "utf8");
}

// A rodada pode ser chamada pelo relógio (instrumentation) e pelo botão da tela, que o Next
// carrega como módulos separados: a trava fica no globalThis, que é um só no processo.
const trava = globalThis as typeof globalThis & { __autoRodando?: boolean };

export async function estadoAuto(): Promise<EstadoAuto> {
  const s = await ler();
  return { ...s, ligado: autoLigado(), rodando: Boolean(trava.__autoRodando) };
}

async function prepararEEnviar(v: VagaBot, item: ItemAuto) {
  const perfil = await lerPerfil();
  const descricao = v.descricao || (await buscarDescricao(v.link));
  const exageroEm = (r: RespostaGerar) => r.checklist.find((c) => c.regra.startsWith("Sem exagerar") && !c.ok);
  let resposta = await gerarCurriculo(perfil, { titulo: item.titulo, descricao }, { automatico: true });
  // A IA às vezes insiste num "liderei"/"gerenciei": gera de novo uma vez antes de pedir revisão.
  if (!resposta.demo && exageroEm(resposta)) {
    resposta = await gerarCurriculo(perfil, { titulo: item.titulo, descricao }, { automatico: true });
  }
  item.resposta = resposta;

  // Travas: o que a skill não deixa passar sem um humano olhar fica para revisão na tela.
  if (resposta.demo) return Object.assign(item, { estado: "revisar", texto: "Sem chave de IA: o currículo não foi escrito pela IA." });
  const exagero = exageroEm(resposta);
  if (exagero) return Object.assign(item, { estado: "revisar", texto: `Não enviei: ${exagero.detalhe}` });

  const html = await folhaEmHtml(resposta.curriculo);
  const marcador = marcadorNoHtml(html);
  if (marcador) return Object.assign(item, { estado: "revisar", texto: `Não enviei: sobrou o marcador ${marcador}.` });

  const r = await pedirCandidatura(v.link, item.titulo, html);
  if (!r.ok) return Object.assign(item, { estado: "erro", texto: String(r.dados.erro ?? "A ponte recusou o pedido.") });
  Object.assign(item, { estado: "fila", texto: "Na fila do vagas-bot...", ponteId: String(r.dados.id) });
}

/** Uma rodada: atualiza as vagas, gera e envia as novas, e confere o andamento das enviadas. */
export async function rodarCiclo(): Promise<string> {
  if (trava.__autoRodando) return "Já tem uma rodada em andamento.";
  trava.__autoRodando = true;
  try {
    const s = await ler();
    if (!s.inicio) s.inicio = agoraSqlite(); // primeira vez: só o que chegar daqui pra frente

    try {
      await atualizarVagasBot();
    } catch (e) {
      console.warn("[auto] git pull do vagas-bot falhou, sigo com o banco local:", e instanceof Error ? e.message : e);
    }

    const vistas = new Set(s.itens.map((i) => i.id));
    const novas = lerVagasBot(1000).filter((v) => v.data > s.inicio && !vistas.has(v.id) && !FICA_PARA_A_TELA.test(v.link));

    for (const v of novas.reverse()) {
      // Mais antigas primeiro, na ordem em que chegaram
      const item: ItemAuto = {
        id: v.id,
        titulo: tituloLimpo(v.titulo),
        empresa: v.empresa,
        link: v.link,
        fonte: v.fonte,
        estado: "gerando",
        texto: "Gerando o currículo...",
        em: new Date().toISOString(),
      };
      s.itens.unshift(item);
      await gravar(s);
      try {
        await prepararEEnviar(v, item);
      } catch (e) {
        Object.assign(item, { estado: "erro", texto: e instanceof Error ? e.message : String(e) });
      }
      console.log(`[auto] ${item.titulo}: ${item.estado}`);
      await gravar(s);
    }

    // Andamento das que estão no candidatar.py (ele pode levar minutos num formulário)
    for (const item of s.itens.filter((i) => i.ponteId && EM_ANDAMENTO.includes(i.estado))) {
      const r = await statusDaCandidatura(item.ponteId!);
      if (r.ok) Object.assign(item, { estado: r.dados.estado, texto: r.dados.texto });
      else if (r.status === 404) Object.assign(item, { estado: "erro", texto: "O candidatar.py reiniciou no meio; confira no Telegram." });
    }

    s.ultimaRodada = new Date().toISOString();
    await gravar(s);
    return novas.length ? `${novas.length} vaga(s) nova(s) processada(s).` : "Nenhuma vaga nova.";
  } finally {
    trava.__autoRodando = false;
  }
}
