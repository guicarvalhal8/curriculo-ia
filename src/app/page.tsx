"use client";

import { useEffect, useState } from "react";
import Curriculo, { curriculoEmTexto } from "@/components/Curriculo";
import type { ItemChecklist, RespostaGerar, Vaga, VagaBot } from "@/lib/tipos";

type Salvo = { id: string; titulo: string; link?: string; data: string; resposta: RespostaGerar };

type Candidatura = {
  id?: string;
  estado: "bloqueada" | "fila" | "candidatando" | "ok" | "teste" | "precisa" | "erro" | "ja_feita";
  texto: string;
  link?: string;
};

const ROTULO_CANDIDATURA: Record<Candidatura["estado"], string> = {
  bloqueada: "Antes de enviar",
  fila: "Na fila",
  candidatando: "Candidatando...",
  ok: "Candidatura enviada",
  teste: "Modo teste: preenchido, não enviado",
  precisa: "Precisa de você",
  erro: "Deu erro",
  ja_feita: "Você já se candidatou",
};

/**
 * A folha como está na tela (com as edições da pessoa) num HTML independente,
 * para o candidatar.py transformar no PDF que vai pra empresa.
 */
function documentoDaFolha(folha: HTMLElement): string {
  const css = Array.from(document.styleSheets)
    .flatMap((s) => {
      try {
        return Array.from(s.cssRules).map((r) => r.cssText);
      } catch {
        return []; // folha de outro domínio: não precisa pra montar o currículo
      }
    })
    .join("\n");
  const copia = folha.cloneNode(true) as HTMLElement;
  copia.removeAttribute("contenteditable");
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body style="background:#fff;margin:0">${copia.outerHTML}</body></html>`;
}
const CHAVE_HISTORICO = "curriculo-ia:historico";

function lerHistorico(): Salvo[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_HISTORICO) || "[]");
  } catch {
    return [];
  }
}
function gravarHistorico(h: Salvo[]) {
  try {
    localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(h.slice(0, 30)));
  } catch {}
}

/** Tira prefixos de local que os repositórios do GitHub colocam no título, como "[Remoto] ". */
const tituloLimpo = (t: string) => t.replace(/^\s*\[[^\]]*\]\s*/, "").trim();

/** A4 em pixels de tela (297mm a 96dpi). */
const ALTURA_A4 = (297 * 96) / 25.4;

/**
 * Passos 1 e 4 medidos na folha renderizada: o servidor só consegue estimar
 * por número de itens e de caracteres.
 */
function medirFolha(): { paginas: number; linhasResumo: number } | null {
  const folha = document.querySelector<HTMLElement>(".folha");
  if (!folha) return null;
  const resumo = folha.querySelector<HTMLElement>(".cv-secao p");
  const linha = resumo ? parseFloat(getComputedStyle(resumo).lineHeight) : 0;
  return {
    paginas: Math.ceil((folha.scrollHeight - 2) / ALTURA_A4),
    linhasResumo: resumo && linha ? Math.round(resumo.offsetHeight / linha) : 0,
  };
}

function comMedidas(lista: ItemChecklist[], m: ReturnType<typeof medirFolha>): ItemChecklist[] {
  if (!m) return lista;
  return lista.map((c) => {
    if (c.regra.startsWith("Resumo"))
      return { regra: "Resumo de no máximo 3 linhas", ok: m.linhasResumo > 0 && m.linhasResumo <= 3, detalhe: `${m.linhasResumo} linha(s) na folha` };
    if (c.regra.startsWith("Cabe em 1 página"))
      return { regra: "Cabe em 1 página", ok: m.paginas <= 1, detalhe: m.paginas > 1 ? `Ocupa ${m.paginas} páginas: corte itens ou projetos` : "Medido na folha A4" };
    return c;
  });
}

const dataCurta = (d: string) =>
  new Date(d.replace(" ", "T") + "Z").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

export default function Gerar() {
  const [vagasBot, setVagasBot] = useState<VagaBot[]>([]);
  const [busca, setBusca] = useState("");
  const [vagaAtiva, setVagaAtiva] = useState("");
  const [erroVagas, setErroVagas] = useState("");
  const [atualizando, setAtualizando] = useState(false);
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [resp, setResp] = useState<RespostaGerar | null>(null);
  const [versao, setVersao] = useState(0);
  const [historico, setHistorico] = useState<Salvo[]>([]);
  const [aviso, setAviso] = useState("");
  const [medidas, setMedidas] = useState<ReturnType<typeof medirFolha>>(null);
  // Link do anúncio do currículo na tela: sem ele (vaga digitada) não dá pra se candidatar daqui.
  const [linkVaga, setLinkVaga] = useState("");
  const [candidatura, setCandidatura] = useState<Candidatura | null>(null);

  // Acompanha a candidatura até um estado final (o candidatar.py pode levar minutos num formulário).
  useEffect(() => {
    if (!candidatura?.id || !["fila", "candidatando"].includes(candidatura.estado)) return;
    const t = setTimeout(async () => {
      const r = await fetch(`/api/candidatar?id=${candidatura.id}`);
      const j = await r.json();
      setCandidatura((c) => (c && c.id === candidatura.id ? { ...c, ...(r.ok ? j : { estado: "erro", texto: j.erro }) } : c));
    }, 2500);
    return () => clearTimeout(t);
  }, [candidatura]);

  useEffect(() => {
    if (!resp) return;
    // Espera a folha aparecer na tela antes de medir.
    const id = requestAnimationFrame(() => setMedidas(medirFolha()));
    return () => cancelAnimationFrame(id);
  }, [resp, versao]);

  useEffect(() => {
    fetch("/api/vagas-bot")
      .then((r) => r.json())
      .then((v) => (Array.isArray(v) ? setVagasBot(v) : setErroVagas(v.erro)));
    fetch("/api/vagas")
      .then((r) => r.json())
      .then((v) => {
        setVagas(v);
        setHistorico(lerHistorico());
      });
  }, []);

  function escolher(v: Vaga) {
    setTitulo(v.titulo);
    setDescricao(v.descricao);
  }

  function avisar(t: string) {
    setAviso(t);
    setTimeout(() => setAviso(""), 2500);
  }

  async function atualizarVagas() {
    setAtualizando(true);
    setErroVagas("");
    const r = await fetch("/api/vagas-bot", { method: "POST" });
    const v = await r.json();
    if (Array.isArray(v)) {
      setVagasBot(v);
      avisar("Vagas atualizadas");
    } else setErroVagas(v.erro);
    setAtualizando(false);
  }

  function escolherDoBot(v: VagaBot) {
    const t = tituloLimpo(v.titulo);
    setVagaAtiva(v.id);
    setTitulo(t);
    setDescricao(v.descricao);
    gerar(t, v.descricao, v.link);
  }

  async function gerar(t = titulo, d = descricao, link = "") {
    setErro("");
    setGerando(true);
    setCandidatura(null);
    try {
      const r = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: t, descricao: d, link }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Erro ao gerar");
      setResp(j);
      setLinkVaga(link);
      if (!d && j.descricaoUsada) setDescricao(j.descricaoUsada);
      setVersao((v) => v + 1);
      const novo: Salvo = { id: crypto.randomUUID(), titulo: t, link, data: new Date().toISOString(), resposta: j };
      const h = [novo, ...lerHistorico()];
      gravarHistorico(h);
      setHistorico(h);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setGerando(false);
    }
  }

  async function salvarVaga() {
    if (!titulo.trim()) return;
    const existe = vagas.find((v) => v.titulo.trim().toLowerCase() === titulo.trim().toLowerCase());
    const novas = existe
      ? vagas.map((v) => (v === existe ? { ...v, descricao } : v))
      : [...vagas, { id: crypto.randomUUID(), titulo: titulo.trim(), descricao }];
    await fetch("/api/vagas", { method: "PUT", body: JSON.stringify(novas) });
    setVagas(novas);
    avisar(existe ? "Vaga atualizada" : "Vaga salva na lista");
  }

  async function removerVaga(v: Vaga) {
    const novas = vagas.filter((x) => x !== v);
    await fetch("/api/vagas", { method: "PUT", body: JSON.stringify(novas) });
    setVagas(novas);
  }

  function abrir(s: Salvo) {
    setResp(s.resposta);
    setTitulo(s.titulo);
    setLinkVaga(s.link ?? "");
    setCandidatura(null);
    setVersao((v) => v + 1);
  }

  function apagar(id: string) {
    const h = historico.filter((s) => s.id !== id);
    gravarHistorico(h);
    setHistorico(h);
  }

  async function copiar() {
    if (!resp) return;
    const el = document.querySelector(".folha") as HTMLElement | null;
    await navigator.clipboard.writeText(el?.innerText || curriculoEmTexto(resp.curriculo));
    avisar("Texto copiado");
  }

  async function candidatar() {
    const folha = document.querySelector<HTMLElement>(".folha");
    if (!folha || !linkVaga) return;
    const marcador = folha.innerText.match(/\[[^\]]{1,40}\]/);
    if (marcador) {
      setCandidatura({ estado: "bloqueada", texto: `Ainda tem o marcador ${marcador[0]} na folha. Clique no texto e troque por um número real (ou apague o trecho) antes de enviar.` });
      return;
    }
    if (!confirm(`Enviar este currículo para a vaga "${titulo}"?`)) return;
    setCandidatura({ estado: "fila", texto: "Enviando para o vagas-bot..." });
    const r = await fetch("/api/candidatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link: linkVaga, titulo, html: documentoDaFolha(folha) }),
    });
    const j = await r.json();
    setCandidatura(r.ok ? { id: j.id, estado: "fila", texto: j.posicao > 1 ? `Na fila (${j.posicao}ª)...` : "Na fila..." } : { estado: "erro", texto: j.erro });
  }

  function baixarPdf() {
    const anterior = document.title;
    const nome = resp?.curriculo.nome ?? "Curriculo";
    document.title = `${nome} - ${titulo}`.replace(/[\\/:*?"<>|]/g, "");
    window.print();
    document.title = anterior;
  }

  return (
    <main className="app">
      <aside className="painel">
        <div className="cabecalho-vagas">
          <h2>Vagas do vagas-bot</h2>
          <button className="pequeno" disabled={atualizando} onClick={atualizarVagas} title="Traz as vagas coletadas desde a última atualização">
            {atualizando ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
        {erroVagas ? (
          <p className="erro">{erroVagas}</p>
        ) : (
          <>
            <input
              className="busca"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={`Filtrar ${vagasBot.length} vagas (cargo, empresa, cidade)`}
            />
            <ul className="vagas-bot">
              {vagasBot
                .filter((v) => `${v.titulo} ${v.empresa} ${v.local}`.toLowerCase().includes(busca.toLowerCase()))
                .map((v) => (
                  <li key={v.id} className={v.id === vagaAtiva ? "ativa" : ""}>
                    <button disabled={gerando} onClick={() => escolherDoBot(v)}>
                      <strong>{tituloLimpo(v.titulo)}</strong>
                      <span>
                        {v.empresa} · {v.local || "local não informado"}
                      </span>
                      <span>
                        {v.fonte} · {dataCurta(v.data)}
                        {!v.descricao && (v.link.includes("indeed.") ? " · sem descrição" : " · descrição buscada no anúncio")}
                      </span>
                    </button>
                    <a href={v.link} target="_blank" rel="noreferrer" title="Abrir o anúncio">
                      ↗
                    </a>
                  </li>
                ))}
            </ul>
          </>
        )}

        <details className="manual">
          <summary>Ou digite uma vaga</summary>
        <div className="chips">
          {vagas.map((v) => (
            <span key={v.id} className={`chip ${v.titulo === titulo ? "ativo" : ""}`}>
              <button onClick={() => { setVagaAtiva(""); escolher(v); }}>{v.titulo}</button>
              <button className="x" title="Remover da lista" onClick={() => removerVaga(v)}>
                ×
              </button>
            </span>
          ))}
        </div>

        <label>
          Nome exato da vaga
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Desenvolvedor Backend Java Júnior" />
        </label>

        <label>
          Descrição da vaga <span className="dica">(cole o anúncio: é daqui que saem as palavras-chave)</span>
          <textarea
            rows={9}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Requisitos, ferramentas, responsabilidades..."
          />
        </label>

        <div className="acoes">
          <button className="primario" disabled={!titulo.trim() || gerando} onClick={() => gerar()}>
            {gerando ? "Gerando..." : "Gerar currículo"}
          </button>
          <button disabled={!titulo.trim()} onClick={salvarVaga}>
            Salvar vaga
          </button>
        </div>
        </details>
        {erro && <p className="erro">{erro}</p>}

        {historico.length > 0 && (
          <>
            <h2>Currículos salvos</h2>
            <ul className="historico">
              {historico.map((s) => (
                <li key={s.id}>
                  <button onClick={() => abrir(s)}>
                    <strong>{s.titulo}</strong>
                    <span>{new Date(s.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                  </button>
                  <button className="x" title="Apagar" onClick={() => apagar(s.id)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </aside>

      <section className="resultado">
        {!resp ? (
          <div className="vazio">
            {gerando ? (
              <p>Montando o currículo para <strong>{titulo}</strong>...</p>
            ) : (
              <p>Clique numa vaga do vagas-bot e o currículo é montado na hora.</p>
            )}
            <p className="dica">
              Um currículo por vaga: a IA troca título, resumo e palavras-chave e usa só os seus dados reais.
            </p>
          </div>
        ) : (
          <>
            <div className="barra">
              <span className="dica">
                {resp.demo ? "Modo demonstração" : `Gerado por ${resp.modelo}`} · clique no texto para ajustar
              </span>
              <div className="acoes">
                <button onClick={copiar}>Copiar texto</button>
                <button onClick={baixarPdf}>Baixar PDF</button>
                {linkVaga && (
                  <button
                    className="primario"
                    disabled={resp.demo || ["fila", "candidatando", "ok"].includes(candidatura?.estado ?? "")}
                    title={resp.demo ? "No modo demonstração o currículo não foi escrito pela IA" : "Envia este currículo pelo vagas-bot"}
                    onClick={candidatar}
                  >
                    Candidatar com este currículo
                  </button>
                )}
              </div>
            </div>

            {candidatura && (
              <div className={`candidatura ${candidatura.estado}`} role="status">
                <strong>{ROTULO_CANDIDATURA[candidatura.estado]}</strong>
                <p>{candidatura.texto}</p>
                {candidatura.link && ["precisa", "erro", "teste"].includes(candidatura.estado) && (
                  <a href={candidatura.link} target="_blank" rel="noreferrer">
                    Abrir a vaga ↗
                  </a>
                )}
                {["fila", "candidatando"].includes(candidatura.estado) && (
                  <small>Se o formulário tiver uma pergunta que o vagas-bot não sabe responder, ele pergunta no seu Telegram.</small>
                )}
              </div>
            )}

            <div className="lado-a-lado">
              <Curriculo key={versao} cv={resp.curriculo} />

              <div className="revisao">
                <h3>Checklist do vídeo</h3>
                <ul className="checklist">
                  {comMedidas(resp.checklist, medidas).map((c) => (
                    <li key={c.regra} className={c.ok ? "ok" : "falha"}>
                      <span>{c.ok ? "✓" : "!"}</span>
                      <div>
                        {c.regra}
                        {c.detalhe && <small>{c.detalhe}</small>}
                      </div>
                    </li>
                  ))}
                </ul>

                {resp.curriculo.pendencias.length > 0 && (
                  <>
                    <h3>Você precisa completar</h3>
                    <ul className="pendencias">
                      {resp.curriculo.pendencias.map((p, i) => (
                        <li key={i}>{p}</li>
                      ))}
                    </ul>
                  </>
                )}

                {resp.curriculo.palavrasChave.length > 0 && (
                  <>
                    <h3>Palavras-chave cobertas</h3>
                    <div className="tags">
                      {resp.curriculo.palavrasChave.map((p) => (
                        <span key={p}>{p}</span>
                      ))}
                    </div>
                  </>
                )}

                <p className="dica">Teste final: abra o PDF no celular. Em 7 segundos dá pra saber quem você é e que vaga quer?</p>
              </div>
            </div>
          </>
        )}
        {aviso && <div className="toast">{aviso}</div>}
      </section>
    </main>
  );
}
