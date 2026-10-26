"use client";

import { useEffect, useState } from "react";
import Curriculo, { curriculoEmTexto } from "@/components/Curriculo";
import type { RespostaGerar, Vaga } from "@/lib/tipos";

type Salvo = { id: string; titulo: string; data: string; resposta: RespostaGerar };
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

export default function Gerar() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [resp, setResp] = useState<RespostaGerar | null>(null);
  const [versao, setVersao] = useState(0);
  const [historico, setHistorico] = useState<Salvo[]>([]);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
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

  async function gerar() {
    setErro("");
    setGerando(true);
    try {
      const r = await fetch("/api/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descricao }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || "Erro ao gerar");
      setResp(j);
      setVersao((v) => v + 1);
      const novo: Salvo = { id: crypto.randomUUID(), titulo, data: new Date().toISOString(), resposta: j };
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
        <h2>1. Escolha a vaga</h2>
        <div className="chips">
          {vagas.map((v) => (
            <span key={v.id} className={`chip ${v.titulo === titulo ? "ativo" : ""}`}>
              <button onClick={() => escolher(v)}>{v.titulo}</button>
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
          <button className="primario" disabled={!titulo.trim() || gerando} onClick={gerar}>
            {gerando ? "Gerando..." : "Gerar currículo"}
          </button>
          <button disabled={!titulo.trim()} onClick={salvarVaga}>
            Salvar vaga
          </button>
        </div>
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
            <p>Escolha uma vaga, cole a descrição e clique em <strong>Gerar currículo</strong>.</p>
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
                <button className="primario" onClick={baixarPdf}>
                  Baixar PDF
                </button>
              </div>
            </div>

            <div className="lado-a-lado">
              <Curriculo key={versao} cv={resp.curriculo} />

              <div className="revisao">
                <h3>Checklist do vídeo</h3>
                <ul className="checklist">
                  {resp.checklist.map((c) => (
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
