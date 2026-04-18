import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panini Stock",
  description: "Sistema de inventario para colecciones Panini",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
