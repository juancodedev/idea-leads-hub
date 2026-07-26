import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/ui/components/ErrorBoundary";
import { Providers } from "@/ui/providers/QueryProvider";
import { RepositoryProvider } from "@/ui/providers/RepositoryProvider";

export const metadata: Metadata = {
  title: {
    template: "%s | IdeaLeadsHub",
    default: "IdeaLeadsHub — Personal CRM",
  },
  description: "A modern, minimalist personal CRM for freelancers and developers.",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="antialiased font-sans">
        <ErrorBoundary>
          <Providers>
            <RepositoryProvider>
              {children}
            </RepositoryProvider>
          </Providers>
        </ErrorBoundary>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
