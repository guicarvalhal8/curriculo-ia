/**
 * Busca a descrição no próprio anúncio, para vagas que o vagas-bot salvou sem ela.
 * Funciona com GitHub, Gupy e LinkedIn. O Indeed bloqueia acesso automático (401).
 */
const NAVEGADOR = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  "Accept-Language": "pt-BR",
};

function htmlEmTexto(html: string): string {
  return html
    .replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function baixar(url: string, headers: Record<string, string> = NAVEGADOR) {
  let r = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  // O LinkedIn limita visitantes em sequência (429); uma pausa curta costuma bastar.
  if (r.status === 429) {
    await new Promise((ok) => setTimeout(ok, 3000));
    r = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  }
  if (!r.ok) throw new Error(`${r.status}`);
  return r;
}

async function doGithub(link: string) {
  const m = link.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!m) return "";
  const r = await baixar(`https://api.github.com/repos/${m[1]}/${m[2]}/issues/${m[3]}`, {
    Accept: "application/vnd.github+json",
  });
  return ((await r.json()).body as string) ?? "";
}

async function daGupy(link: string) {
  const html = await (await baixar(link)).text();
  const dados = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  const job = dados && JSON.parse(dados[1]).props?.pageProps?.job;
  if (!job) return "";
  return htmlEmTexto(
    [job.description, job.responsibilities, job.prerequisites, job.relevantExperiences].filter(Boolean).join("\n"),
  );
}

async function doLinkedin(link: string) {
  const id = link.match(/jobs\/view\/(?:[^/?]*-)?(\d+)/)?.[1];
  if (!id) return "";
  // A página normal devolve 429 sem login; o endpoint de visitante responde.
  const html = await (await baixar(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}`)).text();
  const corpo = html.match(/show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/);
  return corpo ? htmlEmTexto(corpo[1]) : "";
}

export async function buscarDescricao(link: string): Promise<string> {
  try {
    if (link.includes("github.com")) return await doGithub(link);
    if (link.includes("gupy.io")) return await daGupy(link);
    if (link.includes("linkedin.com")) return await doLinkedin(link);
  } catch {
    // Sem descrição a IA ainda gera pelo título; não vale derrubar a geração por isso.
  }
  return "";
}
