import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import type { VagaBot } from "./tipos";

/** Pasta do vagas-bot. Por padrão, ao lado desta pasta, como está no computador do Guilherme. */
export const pastaVagasBot = () =>
  process.env.VAGAS_BOT_DIR || path.join(process.cwd(), "..", "vagas-bot", "vagas-bot");

const caminhoBanco = () => path.join(pastaVagasBot(), "vagas.db");

/** Vagas que o bot enviou pra você (as que passaram no filtro), das mais novas para as mais antigas. */
export function lerVagasBot(limite = 150): VagaBot[] {
  if (!existsSync(caminhoBanco())) {
    throw new Error(`Não achei o vagas.db do vagas-bot em ${caminhoBanco()}. Ajuste VAGAS_BOT_DIR no .env.local.`);
  }
  const db = new DatabaseSync(caminhoBanco(), { readOnly: true });
  try {
    const colunas = db.prepare("PRAGMA table_info(vistas)").all() as { name: string }[];
    if (!colunas.some((c) => c.name === "enviada")) {
      throw new Error("O vagas.db ainda não marca as vagas enviadas. Atualize o vagas-bot (git pull).");
    }
    return db
      .prepare(
        `SELECT v.id, v.titulo, v.empresa, v.local, v.link, v.fonte,
                COALESCE(v.descricao, '') AS descricao, s.vista_em AS data
         FROM vagas v JOIN vistas s ON s.id = v.id
         WHERE s.usuario = 'dono' AND s.enviada = 1
         ORDER BY s.vista_em DESC LIMIT ?`,
      )
      .all(limite) as VagaBot[];
  } finally {
    db.close();
  }
}

/** Traz as vagas coletadas pelas Actions desde o último pull. */
export async function atualizarVagasBot(): Promise<string> {
  const { stdout } = await promisify(execFile)("git", ["pull", "--ff-only"], { cwd: pastaVagasBot() });
  return stdout.trim();
}
