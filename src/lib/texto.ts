/** Tira prefixos de local que os repositórios do GitHub colocam no título, como "[Remoto] ". */
export const tituloLimpo = (t: string) => t.replace(/^\s*\[[^\]]*\]\s*/, "").trim();
