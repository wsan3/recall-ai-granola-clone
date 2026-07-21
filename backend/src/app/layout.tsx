import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Granola Clone Backend",
  description: "Recall.ai Desktop SDK backend: upload tokens, webhooks, and note synthesis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
