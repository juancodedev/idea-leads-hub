"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/ui/components/button";
import { Badge } from "@/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/ui/components/card";
import { Input } from "@/ui/components/input";
import { toast } from "sonner";
import { Instagram, Link2, Link2Off, Loader2, Settings2 } from "lucide-react";

interface InstagramStatus {
  connected: boolean;
  igId?: string;
  expiresAt?: string;
  authType?: string | null;
}

export function InstagramIntegration() {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<InstagramStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [showManual, setShowManual] = React.useState(false);
  const [manualToken, setManualToken] = React.useState("");
  const [manualPageId, setManualPageId] = React.useState("212449262850750");
  const [manualIgId, setManualIgId] = React.useState("17841445859210403");
  const [isConfiguring, setIsConfiguring] = React.useState(false);

  React.useEffect(() => {
    const instagramParam = searchParams.get("instagram");
    const step = searchParams.get("step") || "unknown";
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    // Handle Instagram Business Login OAuth callback (code in URL)
    if (code) {
      exchangeCode(code, state);
      return;
    }

    if (instagramParam === "connected") {
      toast.success("Instagram conectado correctamente");
      window.history.replaceState({}, "", "/settings/profile");
    } else if (instagramParam === "pending") {
      toast.info("Inicio de sesión exitoso. Ahora completá la configuración manual con el Page Token.", {
        duration: 8000,
      });
      window.history.replaceState({}, "", "/settings/profile");
      setShowManual(true);
    } else if (instagramParam === "error") {
      toast.error(`Error al conectar Instagram (${step}). Intentalo de nuevo.`);
      window.history.replaceState({}, "", "/settings/profile");
    }

    fetchStatus();
  }, []);

  // Show manual config automatically when pending
  React.useEffect(() => {
    if (status && "pending" in status && status.pending) {
      setShowManual(true);
    }
  }, [status]);

  async function exchangeCode(code: string, state: string | null) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/instagram/ig-callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, state }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Instagram conectado correctamente");
        window.history.replaceState({}, "", "/settings/profile");
        fetchStatus();
      } else {
        toast.error(data.error || "Error al conectar Instagram", {
          description: data.detail || undefined,
          duration: 8000,
        });
        window.history.replaceState({}, "", "/settings/profile");
      }
    } catch {
      toast.error("Error de conexión al autenticar Instagram");
      window.history.replaceState({}, "", "/settings/profile");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchStatus() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/instagram/status");
      if (response.ok) {
        const data: InstagramStatus = await response.json();
        setStatus(data);
      }
    } catch {
      // Silently fail — user can retry on UI
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/instagram/auth", {
        method: "DELETE",
      });
      if (response.ok) {
        setStatus({ connected: false });
        toast.success("Instagram desconectado");
      } else {
        toast.error("Error al desconectar Instagram");
      }
    } catch {
      toast.error("Error al desconectar Instagram");
    } finally {
      setIsDisconnecting(false);
    }
  }

  function handleConnect() {
    window.location.href = "/api/instagram/ig-auth";
  }

  async function handleManualConfig() {
    if (!manualToken.trim()) {
      toast.error("Pegá el token de acceso primero");
      return;
    }

    setIsConfiguring(true);
    try {
      const body: Record<string, string> = {
        userAccessToken: manualToken.trim(),
      };
      if (manualPageId.trim()) {
        body.pageIdOverride = manualPageId.trim();
      }
      if (manualIgId.trim()) {
        body.igIdOverride = manualIgId.trim();
      }

      const response = await fetch("/api/instagram/auth/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Instagram conectado manualmente");
        setStatus({
          connected: true,
          igId: data.igId,
          expiresAt: data.expiresAt,
        });
        setShowManual(false);
        setManualToken("");
      } else {
        toast.error(data.error || "Error al configurar", {
          description: data.tip || data.pages || undefined,
          duration: 10000,
        });
      }
    } catch {
      toast.error("Error de conexión al configurar Instagram");
    } finally {
      setIsConfiguring(false);
    }
  }

  function formatExpiry(dateStr?: string): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Instagram className="h-5 w-5 text-pink-600" />
          <CardTitle className="text-xl">Instagram Business</CardTitle>
        </div>
        <CardDescription>
          Conectá tu cuenta de Instagram Business para enviar y recibir mensajes
          desde el CRM
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Verificando conexión...</span>
          </div>
        ) : status?.connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="default"
                className="bg-green-600 hover:bg-green-600"
              >
                <Link2 className="h-3 w-3 mr-1" />
                Conectado
              </Badge>
            </div>
            {status.igId && (
              <p className="text-sm text-muted-foreground">
                ID de Instagram:{" "}
                <span className="font-mono">{status.igId}</span>
              </p>
            )}
            {status.authType && (
              <p className="text-sm text-muted-foreground">
                Tipo de autenticación:{" "}
                <span className="font-mono">
                  {status.authType === "instagram_business_login"
                    ? "Instagram Business Login"
                    : "Facebook Login"}
                </span>
              </p>
            )}
            {status.expiresAt && (
              <p className="text-sm text-muted-foreground">
                Expira: {formatExpiry(status.expiresAt)}
              </p>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Link2Off className="h-4 w-4 mr-2" />
              )}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button onClick={handleConnect}>
              <Instagram className="h-4 w-4 mr-2" />
              Conectar Instagram
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  o
                </span>
              </div>
            </div>

            {!showManual ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowManual(true)}
              >
                <Settings2 className="h-4 w-4 mr-2" />
                Configurar manualmente
              </Button>
            ) : (
              <div className="space-y-3 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Pegá un token de acceso de Facebook. Si tenés una página
                  bajo Business Manager, seleccioná "Page Token" en el Graph
                  API Explorer y también completá el ID de la página.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Token de acceso
                  </label>
                  <Input
                    placeholder="EAATestToken..."
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    ID de página (opcional — solo si el token no descubre la página)
                  </label>
                  <Input
                    placeholder="212449262850750"
                    value={manualPageId}
                    onChange={(e) => setManualPageId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    ID de Instagram Business (opcional — para tokens de Instagram)
                  </label>
                  <Input
                    placeholder="17841445859210403"
                    value={manualIgId}
                    onChange={(e) => setManualIgId(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleManualConfig}
                    disabled={isConfiguring || !manualToken.trim()}
                  >
                    {isConfiguring ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : (
                      "Verificar y conectar"
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowManual(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
