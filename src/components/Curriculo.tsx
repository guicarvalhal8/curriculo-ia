import type { Curriculo as C } from "@/lib/tipos";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="cv-secao">
      <h3>{titulo}</h3>
      {children}
    </section>
  );
}

/** Currículo em uma coluna, sem foto, tabela, ícone ou barrinha: do jeito que o ATS lê. */
export default function Curriculo({ cv }: { cv: C }) {
  const c = cv.contato;
  const contato = [c.telefone, c.email, c.linkedin, c.github, c.portfolio, c.cidade].filter(Boolean);

  return (
    <article className="folha" contentEditable suppressContentEditableWarning spellCheck={false}>
      <header className="cv-topo">
        <h1>{cv.nome}</h1>
        <h2>{cv.titulo}</h2>
        <p className="cv-contato">{contato.join("  |  ")}</p>
      </header>

      {cv.resumo && (
        <Secao titulo="Resumo">
          <p>{cv.resumo}</p>
        </Secao>
      )}

      {cv.experiencias.length > 0 && (
        <Secao titulo="Experiência">
          {cv.experiencias.map((e, i) => (
            <div className="cv-item" key={i}>
              <p className="cv-linha">
                <strong>{e.cargo}</strong>
                {e.empresa && <> · {e.empresa}</>}
                {e.periodo && <span className="cv-periodo"> · {e.periodo}</span>}
              </p>
              <ul>
                {e.itens.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </Secao>
      )}

      {cv.projetos.length > 0 && (
        <Secao titulo="Projetos">
          {cv.projetos.map((p, i) => (
            <div className="cv-item" key={i}>
              <p className="cv-linha">
                <strong>{p.nome}</strong>
              </p>
              <ul>
                {p.itens.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </Secao>
      )}

      {cv.formacao.length > 0 && (
        <Secao titulo="Formação">
          {cv.formacao.map((f, i) => (
            <p className="cv-linha" key={i}>
              <strong>{f.curso}</strong>
              {f.instituicao && <> · {f.instituicao}</>}
              {f.periodo && <span className="cv-periodo"> · {f.periodo}</span>}
            </p>
          ))}
        </Secao>
      )}

      {cv.habilidades.length > 0 && (
        <Secao titulo="Habilidades">
          <p>{cv.habilidades.join(", ")}</p>
        </Secao>
      )}

      {cv.idiomas.length > 0 && (
        <Secao titulo="Idiomas">
          <p>{cv.idiomas.join(", ")}</p>
        </Secao>
      )}

      {cv.cursos.length > 0 && (
        <Secao titulo="Cursos">
          <p>{cv.cursos.join(", ")}</p>
        </Secao>
      )}
    </article>
  );
}

/** Versão em texto puro, pra colar em formulário de vaga. */
export function curriculoEmTexto(cv: C): string {
  const c = cv.contato;
  const l: string[] = [
    cv.nome,
    cv.titulo,
    [c.telefone, c.email, c.linkedin, c.github, c.portfolio, c.cidade].filter(Boolean).join(" | "),
    "",
  ];
  if (cv.resumo) l.push("RESUMO", cv.resumo, "");
  if (cv.experiencias.length) {
    l.push("EXPERIÊNCIA");
    cv.experiencias.forEach((e) => {
      l.push([e.cargo, e.empresa, e.periodo].filter(Boolean).join(" · "));
      e.itens.forEach((i) => l.push(`- ${i}`));
    });
    l.push("");
  }
  if (cv.projetos.length) {
    l.push("PROJETOS");
    cv.projetos.forEach((p) => {
      l.push(p.nome);
      p.itens.forEach((i) => l.push(`- ${i}`));
    });
    l.push("");
  }
  if (cv.formacao.length) {
    l.push("FORMAÇÃO");
    cv.formacao.forEach((f) => l.push([f.curso, f.instituicao, f.periodo].filter(Boolean).join(" · ")));
    l.push("");
  }
  if (cv.habilidades.length) l.push("HABILIDADES", cv.habilidades.join(", "), "");
  if (cv.idiomas.length) l.push("IDIOMAS", cv.idiomas.join(", "), "");
  if (cv.cursos.length) l.push("CURSOS", cv.cursos.join(", "), "");
  return l.join("\n").trim();
}
