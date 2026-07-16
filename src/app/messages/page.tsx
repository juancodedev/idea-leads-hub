"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/components/button";
import { Avatar, AvatarFallback } from "@/ui/components/avatar";
import { InstagramConversation } from "@/modules/instagram/components/InstagramConversation";

/* ---------- types ---------- */

interface Conversation {
  leadId: string;
  leadName: string;
  instagramHandle: string | null;
  lastMessage: {
    text: string;
    timestamp: string;
    direction: "inbound" | "outbound";
  };
  unreadCount: number;
  isConnected: boolean;
}

/* ---------- helpers ---------- */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/* ---------- main component ---------- */

export default function MessagesPage() {
  const router = useRouter();

  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedLeadId, setSelectedLeadId] = React.useState<string | null>(null);
  const [messageText, setMessageText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Mobile: track whether we show list or detail
  const [showDetail, setShowDetail] = React.useState(false);

  /* ---------- fetch conversations ---------- */

  const fetchConversations = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/instagram/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      console.error("Failed to fetch conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  /* ---------- mark as read ---------- */

  const markAsRead = React.useCallback(
    async (leadId: string) => {
      const leadConversations = conversations.filter(
        (c) => c.leadId === leadId
      );
      // We only have one entry per lead, but filter defensively
      const conv = leadConversations[0];
      if (!conv || conv.unreadCount === 0) return;

      // Mark as read optimistically
      setConversations((prev) =>
        prev.map((c) =>
          c.leadId === leadId ? { ...c, unreadCount: 0 } : c
        )
      );

      // We don't have activity IDs from the list endpoint,
      // so fetch them and mark each one
      try {
        const res = await fetch(
          `/api/activities?leadId=${leadId}`
        );
        if (!res.ok) return;

        const activities: Array<{ id: string; completed: boolean; type: string }> =
          await res.json();

        const unreadIds = activities
          .filter(
            (a) =>
              !a.completed && a.type === "INSTAGRAM_MESSAGE"
          )
          .map((a) => a.id);

        await Promise.all(
          unreadIds.map((id) =>
            fetch(`/api/activities/${id}/read`, {
              method: "PATCH",
            })
          )
        );
      } catch {
        // Silent — read state is best-effort
      }
    },
    [conversations]
  );

  /* ---------- select conversation ---------- */

  const handleSelectConversation = React.useCallback(
    (leadId: string) => {
      setSelectedLeadId(leadId);
      setShowDetail(true);
      markAsRead(leadId);
    },
    [markAsRead]
  );

  const handleBack = React.useCallback(() => {
    setShowDetail(false);
    setSelectedLeadId(null);
    // Refresh to pick up any changes
    fetchConversations();
  }, [fetchConversations]);

  /* ---------- send message ---------- */

  const handleSend = React.useCallback(async () => {
    if (!selectedLeadId || !messageText.trim()) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/leads/${selectedLeadId}/instagram/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: messageText.trim() }),
        }
      );

      if (res.ok) {
        setMessageText("");
        // Refresh conversations to reflect the new outbound message
        fetchConversations();
        // Force InstagramConversation to re-render by re-selecting
        // (we can't directly refresh it, but Stripe the key to force remount)
        setSelectedLeadId((prev) => {
          // Toggle off and back on briefly
          setTimeout(() => setSelectedLeadId(selectedLeadId), 50);
          return null;
        });
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Send failed:", err);
      }
    } catch {
      console.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }, [selectedLeadId, messageText, fetchConversations]);

  /* ---------- keyboard send ---------- */

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && selectedLeadId) {
        e.preventDefault();
        handleSend();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSend, selectedLeadId]);

  /* ---------- selected conversation data ---------- */

  const selectedConv = React.useMemo(
    () => conversations.find((c) => c.leadId === selectedLeadId),
    [conversations, selectedLeadId]
  );

  /* ---------- empty state ---------- */

  if (!loading && conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <MessageCircle className="h-16 w-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold text-muted-foreground">
          No hay conversaciones
        </h2>
        <p className="text-sm text-muted-foreground/70 mt-1 max-w-md">
          Las conversaciones de Instagram aparecerán acá cuando recibas o
          envíes mensajes a través de la plataforma.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b mb-0">
        <div>
          <h1 className="text-2xl font-bold">Mensajes de Instagram</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bandeja centralizada de mensajes directos
          </p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 mt-4 gap-4">
        {/* ---------- Conversation list (left) ---------- */}
        <div
          className={cn(
            "w-full lg:w-[340px] shrink-0 overflow-y-auto border rounded-lg bg-card",
            showDetail && "hidden lg:block"
          )}
        >
          {loading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <button
                  key={conv.leadId}
                  onClick={() => handleSelectConversation(conv.leadId)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors hover:bg-accent/50",
                    selectedLeadId === conv.leadId && "bg-accent"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 shrink-0 mt-0.5">
                      <AvatarFallback
                        className={cn(
                          "text-sm font-medium",
                          conv.unreadCount > 0
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {getInitials(conv.leadName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm truncate",
                            conv.unreadCount > 0
                              ? "font-semibold"
                              : "font-medium"
                          )}
                        >
                          {conv.leadName}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatRelativeTime(conv.lastMessage.timestamp)}
                        </span>
                      </div>

                      {conv.instagramHandle && (
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                          @{conv.instagramHandle}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {conv.lastMessage.direction === "outbound" && "→ "}
                        {truncate(conv.lastMessage.text, 60)}
                      </p>
                    </div>

                    {conv.unreadCount > 0 && (
                      <div className="shrink-0 mt-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------- Conversation detail (right) ---------- */}
        <div
          className={cn(
            "flex-1 flex flex-col border rounded-lg bg-card min-w-0",
            !showDetail && "hidden lg:flex"
          )}
        >
          {selectedLeadId && selectedConv ? (
            <>
              {/* Detail header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                    {getInitials(selectedConv.leadName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedConv.leadName}
                  </p>
                  {selectedConv.instagramHandle && (
                    <p className="text-xs text-muted-foreground truncate">
                      @{selectedConv.instagramHandle}
                    </p>
                  )}
                </div>
                {!selectedConv.isConnected && (
                  <span className="ml-auto text-xs text-destructive shrink-0">
                    Desconectado
                  </span>
                )}
              </div>

              {/* Messages thread - reuse InstagramConversation */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <InstagramConversation
                  key={selectedLeadId}
                  leadId={selectedLeadId}
                />
              </div>

              {/* Send input */}
              <div className="flex items-end gap-2 p-4 border-t shrink-0">
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Escribí un mensaje..."
                  rows={1}
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onInput={(e) => {
                    const el = e.target as HTMLTextAreaElement;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!messageText.trim() || sending}
                  size="icon"
                  className="shrink-0 h-10 w-10"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            /* Placeholder when no conversation is selected */
            <div className="flex items-center justify-center flex-1">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  Seleccioná una conversación para ver los mensajes
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
