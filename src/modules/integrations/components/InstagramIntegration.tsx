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
import { toast } from "sonner";
import { Instagram, Link2, Link2Off, Loader2 } from "lucide-react";

interface InstagramStatus {
  connected: boolean;
  igId?: string;
  expiresAt?: string;
}

export function InstagramIntegration() {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<InstagramStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  React.useEffect(() => {
    const instagramParam = searchParams.get("instagram");
    if (instagramParam === "connected") {
      toast.success("Instagram conectado correctamente");
      window.history.replaceState({}, "", "/settings/profile");
    } else if (instagramParam === "error") {
      toast.error("Error al conectar Instagram. Intentalo de nuevo.");
      window.history.replaceState({}, "", "/settings/profile");
    }

    fetchStatus();
  }, []);

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
    window.location.href = "/api/instagram/auth";
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
          <Button onClick={handleConnect}>
            <Instagram className="h-4 w-4 mr-2" />
            Conectar Instagram
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
