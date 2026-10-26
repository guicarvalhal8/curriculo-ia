/** Liga o relógio da candidatura automática quando o servidor sobe (AUTO_CANDIDATAR=1). */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.AUTO_CANDIDATAR !== "1") return;
  const { rodarCiclo } = await import("./lib/auto");
  const minutos = Number(process.env.AUTO_INTERVALO_MIN) || 30;
  const rodar = () => rodarCiclo().then((r) => console.log(`[auto] ${r}`)).catch((e) => console.error("[auto] rodada falhou:", e));
  setTimeout(rodar, 60_000); // dá tempo do candidatar.py e da rede subirem junto com o PC
  setInterval(rodar, minutos * 60_000);
  console.log(`[auto] candidatura automática ligada: a cada ${minutos} min`);
}
