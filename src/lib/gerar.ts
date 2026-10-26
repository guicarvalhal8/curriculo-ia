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
  "resumo": "no máximo 3 linhas na folha A4 (cerca de 280 caracteres): quem é, o que domina, o que entrega",
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
- Não aumente o papel do candidato: só use verbos como "liderei", "gerenciei" ou "coordenei" e títulos como "especialista", "especializado" ou "sênior" se os dados disserem isso. Na dúvida, use "desenvolvi", "criei", "implementei" ou "integrei".
- Experiências ficam em ordem cronológica inversa, como no passo 6 (o sistema reordena pelo perfil). Projetos podem ser escolhidos e ordenados pelo que mais importa para a vaga. Pode deixar de fora o que não ajuda.
- Escreva os itens na 1ª pessoa do pretérito ("Desenvolvi", "Integrei", "Criei"), sempre começando pelo verbo.
- Todo item de experiência termina com número ou resultado. Se os dados não têm o número, escreva o item com o marcador entre colchetes no lugar dele, por exemplo "Automatizei [N] relatórios, economizando [X horas/semana]".
- Em "palavrasChave", liste só termos copiados letra por letra da descrição da vaga.
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

/**
 * Tira os marcadores [X] de um texto, para o envio automático (decisão do Guilherme: sem número
 * inventado e sem marcador; o resultado fica descrito em palavras).
 * "aumentando o engajamento em [Z%]." vira "aumentando o engajamento."
 */
export function semMarcadores(texto: string): string {
  const MARCADOR = /\[[^\]]*\]/;
  const t = texto.trim();
  if (!MARCADOR.test(t)) return t;
  const ponto = /[.!]$/.test(t) ? "." : "";
  // Oração secundária com marcador ("..., aumentando o engajamento em [Z%]") sai inteira.
  const [principal, ...resto] = t.replace(/[.!]$/, "").split(/,\s+/);
  const limpo = [principal, ...resto.filter((p) => !MARCADOR.test(p))]
    .join(", ")
    // Na principal, só o marcador sai (e a preposição que ficaria solta no fim).
    .replace(/\s+(?:em|de|para|com|a|até|cerca de)\s+\[[^\]]*\]%?(?=\s*[.,;:]|\s*$)/gi, "")
    .replace(/\s*\[[^\]]*\]%?/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
  return limpo + ponto;
}

/** No automático, troca títulos que exageram por expressões neutras (mesmo sentido, sem se dar um título). */
export function atenuar(texto: string): string {
  return texto
    .replace(/\bespecializad[oa]s? em\b/gi, "com foco em")
    .replace(/\bespecialista em\b/gi, "com experiência em");
}

function normalizar(bruto: Record<string, unknown>, perfil: Perfil, tituloVaga: string, automatico = false): Curriculo {
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
    // Passo 6: sem número, o item ganha um marcador visível para o candidato preencher.
    // No automático ninguém vai preencher, então o item fica como a IA escreveu (e sem marcador).
    const itens = lista(e.itens).map((i) =>
      automatico ? atenuar(semMarcadores(i)) :/\d|\[[^\]]+\]/.test(i) ? i : `${i.replace(/\.$/, "")} [resultado/número].`,
    );
    return [{ original, cargo: original.cargo, empresa: original.empresa, periodo: original.periodo, itens }];
  });
  // Passo 6: ordem cronológica inversa = a ordem do perfil (o mais recente primeiro).
  experiencias.sort((a, b) => perfil.experiencias.indexOf(a.original) - perfil.experiencias.indexOf(b.original));
  if (experiencias.some((e) => e.itens.some((i) => i.includes("[resultado/número]")))) {
    pendencias.push("Troque os marcadores [resultado/número] por números reais (ou apague o trecho), e coloque esses números em Meus dados para os próximos currículos.");
  }

  // Passo 5: "nunca invente uma habilidade para bater com a vaga". O que não está no perfil sai.
  const sugeridas = lista(bruto.habilidades);
  const inventadas = habilidadesForaDoPerfil(sugeridas, perfil);
  if (inventadas.length) {
    pendencias.push(
      `Removi do currículo habilidades que não estão no seu perfil: ${inventadas.join(", ")}. Se você tem alguma, adicione em Meus dados.`,
    );
  }

  return {
    // Nome e contato vêm sempre do perfil, nunca da IA.
    nome: perfil.nome,
    contato: perfil.contato,
    // Passo 3: o título é o nome exato da vaga, não o que a IA achar melhor.
    titulo: tituloVaga,
    resumo: automatico ? atenuar(semMarcadores(s(bruto.resumo))) : s(bruto.resumo),
    experiencias: experiencias.map(({ original: _o, ...e }) => (void _o, e)),
    projetos: arr(bruto.projetos).map((p) => ({
      nome: s(p.nome),
      itens: automatico ? lista(p.itens).map((i) => atenuar(semMarcadores(i))) : lista(p.itens),
    })),
    // Formação, idiomas e cursos não precisam de reescrita: vêm direto do perfil.
    formacao: perfil.formacao,
    habilidades: sugeridas.filter((h) => !inventadas.includes(h)),
    idiomas: perfil.idiomas,
    cursos: perfil.cursos,
    palavrasChave: lista(bruto.palavrasChave),
    pendencias,
  };
}

/** Habilidades que não aparecem em lugar nenhum do perfil. */
function habilidadesForaDoPerfil(habilidades: string[], perfil: Perfil): string[] {
  const textoPerfil = norm(JSON.stringify(perfil));
  const doPerfil = perfil.habilidades.map((h) => norm(h.split(" (")[0]));
  return habilidades.filter((h) => {
    const alvo = norm(h);
    return !textoPerfil.includes(alvo) && !doPerfil.some((p) => p && alvo.includes(p));
  });
}

/** Verbo no pretérito ("Desenvolvi", "Construí", "Desenvolveu", "Implementou"). Gerúndio e substantivo não passam. */
const comecaComVerbo = (item: string) => /^\p{L}+(ei|i|í|ou|eu|iu)(?=[\s,.;:]|$)/u.test(item.trim().normalize("NFC"));

/** Confere as regras dos 7 passos que dá pra checar automaticamente. */
export function validar(c: Curriculo, tituloVaga: string, perfil: Perfil, descricao = ""): ItemChecklist[] {
  const foraDoPerfil = habilidadesForaDoPerfil(c.habilidades, perfil);
  const semVerbo = [...c.experiencias.flatMap((e) => e.itens), ...c.projetos.flatMap((p) => p.itens)].filter(
    (i) => !comecaComVerbo(i),
  );
  const marcadores = c.experiencias.flatMap((e) => e.itens).filter((i) => /\[[^\]]+\]/.test(i)).length;
  // Passo 5: a palavra-chave só vale se estiver escrita como na vaga.
  const desc = norm(descricao);
  const chavesForaDaVaga = desc ? c.palavrasChave.filter((k) => !desc.includes(norm(k))) : [];
  const texto = JSON.stringify(c);
  const itens = [...c.experiencias.flatMap((e) => e.itens), ...c.projetos.flatMap((p) => p.itens)];
  const semNumero = c.experiencias.flatMap((e) => e.itens).filter((i) => !/\d|\[[^\]]+\]/.test(i));
  const faltaContato = (["telefone", "email", "linkedin"] as const).filter((k) => !c.contato[k]);
  const inflados = [c.resumo, ...itens].filter((i) =>
    /\b(liderei|lider(ou|ando)?|gerenci(ei|ou|ando)|coorden(ei|ou|ando)|chefiei|especialista|especializad[oa]|s[eê]nior)\b/i.test(i),
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
      ok: semNumero.length === 0 && marcadores === 0,
      detalhe: semNumero.length
        ? `${semNumero.length} item(ns) sem número`
        : marcadores
          ? `${marcadores} item(ns) com marcador [ ] para você preencher`
          : undefined,
    },
    {
      regra: "Itens começam com verbo de ação",
      ok: semVerbo.length === 0,
      detalhe: semVerbo.length ? `Reescreva: ${semVerbo.map((i) => `"${i.slice(0, 50)}…"`).join("; ")}` : undefined,
    },
    {
      regra: "Palavras-chave escritas como na vaga",
      ok: !desc || (c.palavrasChave.length > 0 && chavesForaDaVaga.length === 0),
      detalhe: !desc
        ? "Sem descrição da vaga: não deu pra conferir"
        : chavesForaDaVaga.length
          ? `Não aparecem assim na vaga: ${chavesForaDaVaga.join(", ")}`
          : `${c.palavrasChave.length} termos copiados da vaga`,
    },
    {
      regra: "Sem exagerar o seu papel (liderei, gerenciei, especialista…)",
      ok: inflados.length === 0,
      detalhe: inflados.length
        ? `Confira se é verdade ou troque o verbo: ${inflados.map((i) => `"${i.slice(0, 60)}…"`).join("; ")}`
        : undefined,
    },
    {
      regra: "Habilidades que estão no seu perfil",
      ok: foraDoPerfil.length === 0,
      detalhe: foraDoPerfil.length
        ? `Não estão no perfil, confirme ou apague: ${foraDoPerfil.join(", ")}`
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

/** Regra trocada no envio automático: ninguém vai estar na tela para preencher marcador. */
const REGRA_AUTOMATICO = `
## Envio automático (vale mais que as regras de marcador acima)
Este currículo será enviado sem revisão humana. NÃO use marcadores entre colchetes em lugar nenhum.
Quando os dados não tiverem número, descreva a entrega ou o resultado em palavras, sem inventar número
(ex.: "Desenvolvi agentes de IA com RAG para o atendimento ao cliente").
`;

export async function gerarCurriculo(
  perfil: Perfil,
  vaga: { titulo: string; descricao: string },
  opcoes: { automatico?: boolean } = {},
): Promise<RespostaGerar> {
  const automatico = Boolean(opcoes.automatico);
  const titulo = vaga.titulo.trim();
  const usarGemini = Boolean(process.env.GEMINI_API_KEY);

  if (!usarGemini && !process.env.ANTHROPIC_API_KEY) {
    const curriculo = gerarDemo(perfil, titulo);
    return { curriculo, checklist: validar(curriculo, titulo, perfil, vaga.descricao), demo: true };
  }

  const skill = await carregarSkill();
  const { nome: _nome, contato: _contato, ...dados } = perfil;
  void _nome;
  void _contato;

  const sistema = `Você é especialista em currículos e segue à risca a skill abaixo.

${skill}
${CONTRATO_SAIDA}${automatico ? REGRA_AUTOMATICO : ""}`;
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

  const curriculo = normalizar(extrairJson(texto) as Record<string, unknown>, perfil, titulo, automatico);
  return { curriculo, checklist: validar(curriculo, titulo, perfil, vaga.descricao), demo: false, modelo };
}
