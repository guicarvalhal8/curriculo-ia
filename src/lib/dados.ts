import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Perfil, Vaga } from "./tipos";

const pasta = path.join(process.cwd(), "data");

export async function lerPerfil(): Promise<Perfil> {
  return JSON.parse(await readFile(path.join(pasta, "perfil.json"), "utf8"));
}

export async function salvarPerfil(perfil: Perfil) {
  await writeFile(path.join(pasta, "perfil.json"), JSON.stringify(perfil, null, 2) + "\n", "utf8");
}

export async function lerVagas(): Promise<Vaga[]> {
  return JSON.parse(await readFile(path.join(pasta, "vagas.json"), "utf8"));
}

export async function salvarVagas(vagas: Vaga[]) {
  await writeFile(path.join(pasta, "vagas.json"), JSON.stringify(vagas, null, 2) + "\n", "utf8");
}
