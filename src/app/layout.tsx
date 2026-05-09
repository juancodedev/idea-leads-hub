import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Idea Leads Hub - Personal CRM",
  description: "A modern, minimalist personal CRM for freelancers and developers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased font-sans">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
