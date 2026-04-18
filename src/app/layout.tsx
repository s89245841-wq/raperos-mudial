import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raperos Mudial",
  description:
    "Aplicación de torneos de freestyle rap con sistema de llaves dinámico y selección aleatoria",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body className="bg-[#0a0a12] text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
