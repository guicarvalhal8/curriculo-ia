import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import type { Curriculo, ItemChecklist, Perfil, RespostaGerar } from "./tipos";

const MODELO_PADRAO = "claude-sonnet-5-5";
const MODELO_GEMINI = "gemini-2.5-flash";

const CONTRATO_SAIDA = `
## Como responder (obrigatório)
Responda APENAS com um objeto JSON válido, sem texto antes ou depois e sem bloco de código, neste formato:
{
  "titulo": "nome exato da vaga",
  "resumo": "no máximo 3 linhas: quem é, o que domina, o que entrega",
  "experiencias": [{ "cargo": "", "empresa": "", "periodo": "", "itens": ["Verbo de ação + entrega + número"] }],
  "projetos": [{ "nome": "", "itens": ["Verbo de ação + entrega + resultado"] }],
  "formacao": [{ "curso": "", "instituicao": "", "periodo": "" }],
  "habilidades": ["só habilidades que o candidato tem, priorizando as que a vaga pede, escritas como a vaga escreve"],
  "idiomas": [],
  "cursos": [],
  "palavrasChave": ["palavras-chave da vaga que você conseguiu cobrir com dados reais do candidato"],
  "pendencias": ["o que o candidato precisa completar ou confirmar (ex.: métricas marcadas com [ ], período faltando, habilidade da vaga que ele não tem)"]
}

Regras extras:
- Não gere nome nem contato: o sistema preenche isso direto do perfil.
- Copie "empresa" exatamente como está nos dados (o sistema usa esse campo para buscar cargo e período originais).
- Nunca invente empresa, cargo, período, habilidade ou número. Quando faltar um número, use um marcador entre colchetes, como [X%] ou [N clientes], e registre em "pendencias".
- Não aumente o papel do candidato: só use verbos como "liderei", "gerenciei" ou "coordenei" e títulos como "especialista" ou "sênior" se os dados disserem isso. Na dúvida, use "desenvolvi", "criei", "implementei" ou "integrei".
- Escolha e ordene experiências e projetos pelo que mais importa para a vaga. Pode deixar de fora o que não ajuda.
- Máximo de 4 itens por experiência e 2 por projeto, para caber em 1 página.
- Se a vaga pede algo que o candidato não tem, NÃO coloque no currículo: avise em "pendencias".
- Escreva em português do Brasil.
`;

async function carregarSkill(): Promise<string> {
  return readFile(path.join(process.cwd(), "src/lib/skill-curriculo-ats.md"), "utf8");
}

function extrairJson(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/g, "").trim();
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini === -1 || fim === -1) throw new Error("A IA não devolveu JSON.");
  return JSON.parse(limpo.slice(ini, fim + 1));
}

const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Acha a experiência do perfil que a IA reescreveu, pela empresa. */
function experienciaDoPerfil(perfil: Perfil, empresa: string) {
  const alvo = norm(empresa);
  if (!alvo) return undefined;
  return perfil.experiencias.find((p) => {
    const e = norm(p.empresa);
    return e && (e.includes(alvo) || alvo.includes(e) || e.split(" (")[0] === alvo.split(" (")[0]);
  });
}

function normalizar(bruto: Record<string, unknown>, perfil: Perfil): Curriculo {
  const arr = (v: unknown) => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const pendencias = lista(bruto.pendencias);

  // Cargo, empresa e período vêm sempre do perfil: a IA só reescreve as atividades.
  const experiencias = arr(bruto.experiencias).flatMap((e) => {
    const original = experienciaDoPerfil(perfil, s(e.empresa));
    if (!original) {
      pendencias.unshift(`A IA citou uma experiência que não está no seu perfil ("${s(e.cargo)} – ${s(e.empresa)}") e ela foi removida.`);
      return [];
    }
    return [{ cargo: original.cargo, empresa: original.empresa, periodo: original.periodo, itens: lista(e.itens) }];
  });

  return {
    // Nome e contato vêm sempre do perfil, nunca da IA.
    nome: perfil.nome,
    contato: perfil.contato,
    titulo: s(bruto.titulo),
    resumo: s(bruto.resumo),
    experiencias,
    projetos: arr(bruto.projetos).map((p) => ({ nome: s(p.nome), itens: lista(p.itens) })),
    formacao: arr(bruto.formacao).map((f) => ({
      curso: s(f.curso),
      instituicao: s(f.instituicao),
      periodo: s(f.periodo),
    })),
    habilidades: lista(bruto.habilidades),
    idiomas: lista(bruto.idiomas),
    cursos: lista(bruto.cursos),
    palavrasChave: lista(bruto.palavrasChave),
    pendencias,
  };
}

/** Confere as regras do vídeo que dá pra checar automaticamente. */
export function validar(c: Curriculo, tituloVaga: string): ItemChecklist[] {
  const texto = JSON.stringify(c);
  const itens = [...c.experiencias.flatMap((e) => e.itens), ...c.projetos.flatMap((p) => p.itens)];
  const semNumero = c.experiencias.flatMap((e) => e.itens).filter((i) => !/\d|\[[^\]]+\]/.test(i));
  const faltaContato = (["telefone", "email", "linkedin"] as const).filter((k) => !c.contato[k]);
  const inflados = [c.resumo, ...itens].filter((i) =>
    /\b(liderei|lider(ou|ando)?|gerenciei|coordenei|chefiei|especialista|s[eê]nior)\b/i.test(i),
  );

  return [
    {
      regra: "Topo com nome, telefone, e-mail e LinkedIn",
      ok: faltaContato.length === 0,
      detalhe: faltaContato.length ? `Falta no perfil: ${faltaContato.join(", ")}` : undefined,
    },
    {
      regra: "Sem CPF, idade ou endereço completo",
      ok: !/\d{3}\.?\d{3}\.?\d{3}-?\d{2}|\bCPF\b|\b\d{2}\s?anos\b(?!\s+de)|\bRua\b|\bAv\.|\bCEP\b/i.test(texto),
    },
    {
      regra: "Título igual ao nome da vaga",
      ok: norm(c.titulo) === norm(tituloVaga),
      detalhe: norm(c.titulo) === norm(tituloVaga) ? undefined : `Título gerado: "${c.titulo}"`,
    },
    {
      regra: "Resumo de no máximo 3 linhas",
      ok: c.resumo.length > 0 && c.resumo.length <= 330,
      detalhe: `${c.resumo.length} caracteres (limite ~330)`,
    },
    {
      regra: "Experiências com número ou resultado",
      ok: semNumero.length === 0,
      detalhe: semNumero.length ? `${semNumero.length} item(ns) sem número` : undefined,
    },
    {
      regra: "Sem exagerar o seu papel (liderei, gerenciei, especialista…)",
      ok: inflados.length === 0,
      detalhe: inflados.length
        ? `Confira se é verdade ou troque o verbo: ${inflados.map((i) => `"${i.slice(0, 60)}…"`).join("; ")}`
        : undefined,
    },
    {
      regra: "Cabe em 1 página (até ~14 itens)",
      ok: itens.length <= 14,
      detalhe: `${itens.length} itens`,
    },
  ];
}

function gerarDemo(perfil: Perfil, titulo: string): Curriculo {
  return {
    nome: perfil.nome,
    contato: perfil.contato,
    titulo,
    resumo: perfil.sobre,
    experiencias: perfil.experiencias.map((e) => ({
      cargo: e.cargo,
      empresa: e.empresa,
      periodo: e.periodo,
      itens: e.atividades.slice(0, 4).map((a) => `${a} [resultado/número]`),
    })),
    projetos: perfil.projetos.slice(0, 3).map((p) => ({ nome: p.nome, itens: [p.descricao] })),
    formacao: perfil.formacao,
    habilidades: perfil.habilidades,
    idiomas: perfil.idiomas,
    cursos: perfil.cursos,
    palavrasChave: [],
    pendencias: [
      "MODO DEMONSTRAÇÃO: este currículo não foi escrito pela IA, só montado com os dados do perfil. Configure GEMINI_API_KEY (gratuita) ou ANTHROPIC_API_KEY no arquivo .env.local para gerar de verdade.",
    ],
  };
}

/** Modelos tentados, em ordem, quando o anterior está sobrecarregado (503) ou sem cota (429). */
const RESERVAS_GEMINI = ["gemini-flash-lite-latest", "gemini-flash-latest"];

class GeminiOcupado extends Error {}

async function chamarGemini(modeloPreferido: string, sistema: string, pedido: string) {
  const modelos = [modeloPreferido, ...RESERVAS_GEMINI.filter((m) => m !== modeloPreferido)];
  let ultimoErro: Error | undefined;
  for (const modelo of modelos) {
    // Cada modelo ganha 2 tentativas: o 503 do plano gratuito costuma passar em segundos.
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        return { modelo, texto: await chamarGeminiUmaVez(modelo, sistema, pedido) };
      } catch (e) {
        const estourouTempo = e instanceof Error && e.name === "TimeoutError";
        if (!(e instanceof GeminiOcupado) && !estourouTempo) throw e;
        // Se o modelo travou, insistir nele só dobra a espera: vai direto para o próximo.
        if (estourouTempo) {
          ultimoErro = new Error(`${modelo}: sem resposta em 60s`);
          break;
        }
        ultimoErro = e;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  throw new Error(`O Gemini está sobrecarregado ou sem cota no momento. Tente de novo em alguns minutos. (${ultimoErro?.message})`);
}

async function chamarGeminiUmaVez(modelo: string, sistema: string, pedido: string): Promise<string> {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
    {
      method: "POST",
      // Sem limite, o plano gratuito às vezes segura a conexão por minutos.
      signal: AbortSignal.timeout(60_000),
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: "user", parts: [{ text: pedido }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 16000 },
      }),
    },
  );
  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.error?.message ?? resp.statusText;
    if (resp.status === 429 || resp.status === 503 || resp.status === 500) {
      throw new GeminiOcupado(`${modelo}: ${resp.status}`);
    }
    throw new Error(`Gemini respondeu ${resp.status}: ${msg}`);
  }
  const cand = json.candidates?.[0];
  if (!cand) throw new Error(`O Gemini bloqueou o pedido (${json.promptFeedback?.blockReason ?? "sem resposta"}).`);
  if (cand.finishReason === "MAX_TOKENS") throw new Error("A resposta da IA veio cortada. Tente de novo.");
  return (cand.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
}

async function chamarClaude(modelo: string, sistema: string, pedido: string): Promise<string> {
  const client = new Anthropic();
  // Se o filtro de segurança recusar, a própria API refaz o pedido no modelo reserva.
  const msg = await client.beta.messages.create({
    model: modelo,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: sistema,
    messages: [{ role: "user", content: pedido }],
  });
  if (msg.stop_reason === "refusal") throw new Error("A IA recusou o pedido. Revise a descrição da vaga e tente de novo.");
  if (msg.stop_reason === "max_tokens") throw new Error("A resposta da IA veio cortada. Tente de novo.");
  return msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
}

export async function gerarCurriculo(
  perfil: Perfil,
  vaga: { titulo: string; descricao: string },
): Promise<RespostaGerar> {
  const titulo = vaga.titulo.trim();
  const usarGemini = Boolean(process.env.GEMINI_API_KEY);

  if (!usarGemini && !process.env.ANTHROPIC_API_KEY) {
    const curriculo = gerarDemo(perfil, titulo);
    return { curriculo, checklist: validar(curriculo, titulo), demo: true };
  }

  const skill = await carregarSkill();
  const { nome: _nome, contato: _contato, ...dados } = perfil;
  void _nome;
  void _contato;

  const sistema = `Você é especialista em currículos e segue à risca a skill abaixo.

${skill}
${CONTRATO_SAIDA}`;
  const hoje = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const pedido = `DATA DE HOJE: ${hoje} (períodos até esta data são válidos, não são erro)

VAGA ALVO: ${titulo}

DESCRIÇÃO DA VAGA:
${
    vaga.descricao.trim() || "(não informada: use as palavras-chave mais comuns para essa vaga, mas só as que o candidato tem)"
  }

DADOS DO CANDIDATO (JSON):
${JSON.stringify(dados, null, 2)}`;

  // O Gemini tem prioridade quando as duas chaves existem, porque tem plano gratuito.
  const { modelo, texto } = usarGemini
    ? await chamarGemini(process.env.GEMINI_MODEL || MODELO_GEMINI, sistema, pedido)
    : await (async () => {
        const modelo = process.env.ANTHROPIC_MODEL || MODELO_PADRAO;
        return { modelo, texto: await chamarClaude(modelo, sistema, pedido) };
      })();

  const curriculo = normalizar(extrairJson(texto) as Record<string, unknown>, perfil);
  if (!curriculo.titulo) curriculo.titulo = titulo;
  return { curriculo, checklist: validar(curriculo, titulo), demo: false, modelo };
}
