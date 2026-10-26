import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Currículo IA",
  description: "Gera um currículo focado na vaga, do jeito que o ATS e o recrutador leem.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>
        <nav className="topo">
          <span className="marca">Currículo IA</span>
          <div className="links">
            <Link href="/">Gerar</Link>
            <Link href="/perfil">Meus dados</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
