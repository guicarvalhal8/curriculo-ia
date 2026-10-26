import { readFile } from "node:fs/promises";
import path from "node:path";
import { curriculoEmHtml, documentoHtml } from "@/components/Curriculo";
import type { Curriculo as CV } from "./tipos";

/** A mesma folha da tela, montada no servidor para o envio automático. */
export async function folhaEmHtml(cv: CV): Promise<string> {
  const css = await readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8");
  return documentoHtml(`<article class="folha">${curriculoEmHtml(cv)}</article>`, css);
}
