"use client";

import { useEffect, useState } from "react";
import type { Contato, Perfil } from "@/lib/tipos";

const linhas = (t: string) => t.split("\n").map((s) => s.trim()).filter(Boolean);

function Lista({ rotulo, valor, onChange, dica }: { rotulo: string; valor: string[]; onChange: (v: string[]) => void; dica?: string }) {
  const [texto, setTexto] = useState(valor.join("\n"));
  return (
    <label>
      {rotulo} {dica && <span className="dica">({dica})</span>}
      <textarea
        rows={Math.max(3, valor.length + 1)}
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          onChange(linhas(e.target.value));
        }}
      />
    </label>
  );
}

export default function PaginaPerfil() {
  const [p, setP] = useState<Perfil | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch("/api/perfil").then((r) => r.json()).then(setP);
  }, []);

  if (!p) return <main className="perfil">Carregando...</main>;

  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setP({ ...p, [k]: v });
  const setContato = (k: keyof Contato, v: string) => set("contato", { ...p.contato, [k]: v });

  async function salvar() {
    setStatus("Salvando...");
    const r = await fetch("/api/perfil", { method: "PUT", body: JSON.stringify(p) });
    setStatus(r.ok ? "Dados salvos ✓" : "Erro ao salvar");
    setTimeout(() => setStatus(""), 2500);
  }

  const contatos: [keyof Contato, string][] = [
    ["telefone", "Telefone"],
    ["email", "E-mail"],
    ["linkedin", "LinkedIn"],
    ["github", "GitHub"],
    ["portfolio", "Portfólio"],
    ["cidade", "Cidade/UF"],
  ];

  return (
    <main className="perfil">
      <div className="barra">
        <div>
          <h1>Meus dados</h1>
          <p className="dica">
            A IA só usa o que estiver aqui. Quanto mais números reais você colocar nas atividades, melhor fica o currículo.
          </p>
        </div>
        <div className="acoes">
          {status && <span className="dica">{status}</span>}
          <button className="primario" onClick={salvar}>
            Salvar
          </button>
        </div>
      </div>

      <fieldset>
        <legend>Topo</legend>
        <label>
          Nome
          <input value={p.nome} onChange={(e) => set("nome", e.target.value)} />
        </label>
        <div className="grade">
          {contatos.map(([k, r]) => (
            <label key={k}>
              {r}
              <input value={p.contato[k]} onChange={(e) => setContato(k, e.target.value)} />
            </label>
          ))}
        </div>
        <p className="dica">CPF, idade e endereço completo não entram no currículo, por isso não têm campo aqui.</p>
      </fieldset>

      <fieldset>
        <legend>Sobre você</legend>
        <label>
          Quem você é, o que domina, o que entrega
          <textarea rows={3} value={p.sobre} onChange={(e) => set("sobre", e.target.value)} />
        </label>
        <label>
          Observações para a IA <span className="dica">(contexto que não vai no currículo, mas ajuda a escrever)</span>
          <textarea rows={2} value={p.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </label>
      </fieldset>

      <fieldset>
        <legend>Experiências</legend>
        {p.experiencias.map((ex, i) => {
          const upd = (campo: string, v: unknown) =>
            set("experiencias", p.experiencias.map((e, j) => (j === i ? { ...e, [campo]: v } : e)));
          return (
            <div className="cartao" key={i}>
              <div className="grade">
                <label>
                  Cargo
                  <input value={ex.cargo} onChange={(e) => upd("cargo", e.target.value)} />
                </label>
                <label>
                  Empresa
                  <input value={ex.empresa} onChange={(e) => upd("empresa", e.target.value)} />
                </label>
                <label>
                  Período
                  <input value={ex.periodo} onChange={(e) => upd("periodo", e.target.value)} placeholder="mm/aaaa – atual" />
                </label>
              </div>
              <Lista
                rotulo="Atividades e resultados"
                dica="uma por linha; coloque números sempre que tiver"
                valor={ex.atividades}
                onChange={(v) => upd("atividades", v)}
              />
              <button className="remover" onClick={() => set("experiencias", p.experiencias.filter((_, j) => j !== i))}>
                Remover experiência
              </button>
            </div>
          );
        })}
        <button onClick={() => set("experiencias", [...p.experiencias, { cargo: "", empresa: "", periodo: "", atividades: [] }])}>
          + Adicionar experiência
        </button>
      </fieldset>

      <fieldset>
        <legend>Projetos</legend>
        <p className="dica">Sem experiência na área? Projeto, freelance, voluntariado e faculdade contam: tudo que teve entrega.</p>
        {p.projetos.map((pr, i) => {
          const upd = (campo: string, v: string) =>
            set("projetos", p.projetos.map((x, j) => (j === i ? { ...x, [campo]: v } : x)));
          return (
            <div className="cartao" key={i}>
              <label>
                Nome
                <input value={pr.nome} onChange={(e) => upd("nome", e.target.value)} />
              </label>
              <label>
                O que é, o que você fez e o resultado
                <textarea rows={2} value={pr.descricao} onChange={(e) => upd("descricao", e.target.value)} />
              </label>
              <button className="remover" onClick={() => set("projetos", p.projetos.filter((_, j) => j !== i))}>
                Remover projeto
              </button>
            </div>
          );
        })}
        <button onClick={() => set("projetos", [...p.projetos, { nome: "", descricao: "" }])}>+ Adicionar projeto</button>
      </fieldset>

      <fieldset>
        <legend>Formação</legend>
        {p.formacao.map((f, i) => {
          const upd = (campo: string, v: string) =>
            set("formacao", p.formacao.map((x, j) => (j === i ? { ...x, [campo]: v } : x)));
          return (
            <div className="cartao grade" key={i}>
              <label>
                Curso
                <input value={f.curso} onChange={(e) => upd("curso", e.target.value)} />
              </label>
              <label>
                Instituição
                <input value={f.instituicao} onChange={(e) => upd("instituicao", e.target.value)} />
              </label>
              <label>
                Período
                <input value={f.periodo} onChange={(e) => upd("periodo", e.target.value)} />
              </label>
              <button className="remover" onClick={() => set("formacao", p.formacao.filter((_, j) => j !== i))}>
                Remover
              </button>
            </div>
          );
        })}
        <button onClick={() => set("formacao", [...p.formacao, { curso: "", instituicao: "", periodo: "" }])}>+ Adicionar formação</button>
      </fieldset>

      <fieldset>
        <legend>Habilidades, idiomas e cursos</legend>
        <div className="grade">
          <Lista rotulo="Habilidades" dica="uma por linha" valor={p.habilidades} onChange={(v) => set("habilidades", v)} />
          <Lista rotulo="Idiomas" dica="ex.: Inglês intermediário" valor={p.idiomas} onChange={(v) => set("idiomas", v)} />
          <Lista rotulo="Cursos e certificações" dica="uma por linha" valor={p.cursos} onChange={(v) => set("cursos", v)} />
        </div>
      </fieldset>

      <div className="acoes fim">
        <button className="primario" onClick={salvar}>
          Salvar
        </button>
      </div>
    </main>
  );
}
