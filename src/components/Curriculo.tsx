import type { Curriculo as C } from "@/lib/tipos";

const esc = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const secao = (titulo: string, corpo: string) => `<section class="cv-secao"><h3>${esc(titulo)}</h3>${corpo}</section>`;

const lista = (itens: string[]) => `<ul>${itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

/**
 * O miolo da folha em HTML. É o modelo único: a tela mostra isto e o envio automático
 * transforma isto em PDF no servidor, então os dois nunca ficam diferentes.
 */
export function curriculoEmHtml(cv: C): string {
  const c = cv.contato;
  const contato = [c.telefone, c.email, c.linkedin, c.github, c.portfolio, c.cidade].filter(Boolean);
  const partes = [
    `<header class="cv-topo"><h1>${esc(cv.nome)}</h1><h2>${esc(cv.titulo)}</h2><p class="cv-contato">${contato.map(esc).join("  |  ")}</p></header>`,
  ];
  if (cv.resumo) partes.push(secao("Resumo", `<p>${esc(cv.resumo)}</p>`));
  if (cv.experiencias.length)
    partes.push(
      secao(
        "Experiência",
        cv.experiencias
          .map(
            (e) =>
              `<div class="cv-item"><p class="cv-linha"><strong>${esc(e.cargo)}</strong>${e.empresa ? ` · ${esc(e.empresa)}` : ""}${
                e.periodo ? `<span class="cv-periodo"> · ${esc(e.periodo)}</span>` : ""
              }</p>${lista(e.itens)}</div>`,
          )
          .join(""),
      ),
    );
  if (cv.projetos.length)
    partes.push(
      secao(
        "Projetos",
        cv.projetos.map((p) => `<div class="cv-item"><p class="cv-linha"><strong>${esc(p.nome)}</strong></p>${lista(p.itens)}</div>`).join(""),
      ),
    );
  if (cv.formacao.length)
    partes.push(
      secao(
        "Formação",
        cv.formacao
          .map(
            (f) =>
              `<p class="cv-linha"><strong>${esc(f.curso)}</strong>${f.instituicao ? ` · ${esc(f.instituicao)}` : ""}${
                f.periodo ? `<span class="cv-periodo"> · ${esc(f.periodo)}</span>` : ""
              }</p>`,
          )
          .join(""),
      ),
    );
  if (cv.habilidades.length) partes.push(secao("Habilidades", `<p>${esc(cv.habilidades.join(", "))}</p>`));
  if (cv.idiomas.length) partes.push(secao("Idiomas", `<p>${esc(cv.idiomas.join(", "))}</p>`));
  if (cv.cursos.length) partes.push(secao("Cursos", `<p>${esc(cv.cursos.join(", "))}</p>`));
  return partes.join("");
}

/** Documento completo (folha + CSS) para virar PDF. */
export function documentoHtml(folha: string, css: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><style>${css}</style></head><body style="background:#fff;margin:0">${folha}</body></html>`;
}

/** Currículo em uma coluna, sem foto, tabela, ícone ou barrinha: do jeito que o ATS lê. */
export default function Curriculo({ cv }: { cv: C }) {
  return (
    <article
      className="folha"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      dangerouslySetInnerHTML={{ __html: curriculoEmHtml(cv) }}
    />
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
