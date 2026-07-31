import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Speed Bikers — Gestão de Compras",
  description: "Dashboard de curva ABC, saúde de produtos e reposição",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
