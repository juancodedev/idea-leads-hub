"use client";

import * as React from "react";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  Trash2,
  Link2,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { Skeleton } from "@/ui/components/skeleton";
import { EmptyState } from "@/ui/components/EmptyState";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/components/button";
import { Avatar, AvatarFallback } from "@/ui/components/avatar";
import { DashboardLayout } from "@/ui/layouts/DashboardLayout";
import { InstagramConversation } from "@/modules/instagram/components/InstagramConversation";
import { LeadSearchModal } from "@/modules/leads/components/LeadSearchModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/components/dropdown-menu";
import { toast } from "sonner";

/* ---------- types ---------- */

interface Conversation {
  id: string;
  leadId: string | null;
  leadName: string;
  instagramHandle: string | null;
  instagramScopedId: string | null;
  lastMessage: {
    text: string;
    timestamp: string;
    direction: "inbound" | "outbound";
  };
  unreadCount: number;
  isConnected: boolean;
  isLinked: boolean;
}

interface ConversationMessage {
  id: string;
  text: string;
  direction: "inbound" | "outbound";
  timestamp: string;
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
  const [conversations, setConversations] = React.useState<Conversation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [messageText, setMessageText] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Unlinked conversation live messages
  const [unlinkedMessages, setUnlinkedMessages] = React.useState<ConversationMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(false);

  // Mobile
  const [showDetail, setShowDetail] = React.useState(false);

  // Link modal
  const [linkModalOpen, setLinkModalOpen] = React.useState(false);
  const [linkingConvId, setLinkingConvId] = React.useState<string | null>(null);

  // Delete confirmation
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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

  /* ---------- fetch unlinked messages ---------- */

  const fetchUnlinkedMessages = React.useCallback(async (key: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?key=${encodeURIComponent(key)}`);
      if (res.ok) {
        const data = await res.json();
        setUnlinkedMessages(data);
      }
    } catch {
      console.error("Failed to fetch messages");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  /* ---------- mark as read ---------- */

  const markAsRead = React.useCallback(
    async (conv: Conversation) => {
      if (!conv.leadId || conv.unreadCount === 0) return;

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conv.id ? { ...c, unreadCount: 0 } : c
        )
      );

      try {
        const res = await fetch(`/api/activities?leadId=${conv.leadId}`);
        if (!res.ok) return;

        const activities: Array<{ id: string; completed: boolean; type: string }> =
          await res.json();

        const unreadIds = activities
          .filter((a) => !a.completed && a.type === "INSTAGRAM_MESSAGE")
          .map((a) => a.id);

        await Promise.all(
          unreadIds.map((id) =>
            fetch(`/api/activities/${id}/read`, { method: "PATCH" })
          )
        );
      } catch {
        // Silent
      }
    },
    [conversations]
  );

  /* ---------- select conversation ---------- */

  const selectedConv = React.useMemo(
    () => conversations.find((c) => c.id === selectedId),
    [conversations, selectedId]
  );

  const handleSelectConversation = React.useCallback(
    (conv: Conversation) => {
      setSelectedId(conv.id);
      setShowDetail(true);

      if (conv.isLinked) {
        markAsRead(conv);
        setUnlinkedMessages([]);
      } else {
        // Unlinked — fetch messages via our API
        fetchUnlinkedMessages(conv.id);
      }
    },
    [markAsRead, fetchUnlinkedMessages]
  );

  const handleBack = React.useCallback(() => {
    setShowDetail(false);
    setSelectedId(null);
    setUnlinkedMessages([]);
    fetchConversations();
  }, [fetchConversations]);

  /* ---------- delete conversation ---------- */

  const handleDelete = React.useCallback(
    async (conv: Conversation) => {
      setDeletingId(conv.id);
      try {
        const res = await fetch(
          `/api/messages?key=${encodeURIComponent(conv.id)}`,
          { method: "DELETE" }
        );

        if (res.ok) {
          toast.success("Conversación eliminada");
          setConversations((prev) => prev.filter((c) => c.id !== conv.id));
          if (selectedId === conv.id) {
            setSelectedId(null);
            setShowDetail(false);
            setUnlinkedMessages([]);
          }
        } else {
          toast.error("Error al eliminar la conversación");
        }
      } catch {
        toast.error("Error al eliminar la conversación");
      } finally {
        setDeletingId(null);
      }
    },
    [selectedId]
  );

  /* ---------- open link modal ---------- */

  const handleOpenLink = React.useCallback((convId: string) => {
    setLinkingConvId(convId);
    setLinkModalOpen(true);
  }, []);

  const handleLinkLead = React.useCallback(
    async (lead: { id: string; name: string }) => {
      if (!linkingConvId) return;

      try {
        const res = await fetch("/api/messages", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: linkingConvId, leadId: lead.id }),
        });

        if (res.ok) {
          toast.success(`Vinculado a ${lead.name}`);
          fetchConversations();
          if (selectedId === linkingConvId) {
            setSelectedId(null);
            setShowDetail(false);
            setUnlinkedMessages([]);
          }
        } else {
          toast.error("Error al vincular la conversación");
        }
      } catch {
        toast.error("Error al vincular la conversación");
      } finally {
        setLinkingConvId(null);
      }
    },
    [linkingConvId, fetchConversations, selectedId]
  );

  /* ---------- send message ---------- */

  const handleSend = React.useCallback(async () => {
    if (!selectedConv?.leadId || !messageText.trim()) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/leads/${selectedConv.leadId}/instagram/send`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: messageText.trim() }),
        }
      );

      if (res.ok) {
        setMessageText("");
        fetchConversations();
        // Remount InstagramConversation on next render
        setSelectedId((prev) => {
          setTimeout(() => selectedConv && setSelectedId(selectedConv.id), 50);
          return null;
        });
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("Send failed:", err);
        toast.error("Error al enviar el mensaje");
      }
    } catch {
      toast.error("Error al enviar el mensaje");
    } finally {
      setSending(false);
    }
  }, [selectedConv, messageText, fetchConversations]);

  /* ---------- keyboard send ---------- */

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && selectedConv?.isLinked && selectedConv.leadId) {
        e.preventDefault();
        handleSend();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSend, selectedConv]);

  /* ---------- empty state ---------- */

  if (!loading && conversations.length === 0) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={MessageCircle}
          title="No hay conversaciones"
          description="Las conversaciones de Instagram aparecerán acá cuando recibas o envíes mensajes a través de la plataforma."
        />
      </DashboardLayout>
    );
  }

  /* ---------- render ---------- */

  return (
    <DashboardLayout>
      <LeadSearchModal
        open={linkModalOpen}
        onOpenChange={setLinkModalOpen}
        onSelect={handleLinkLead}
      />

      <div className="flex flex-col h-[calc(100vh-10rem)]">
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
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group relative",
                      selectedId === conv.id && "bg-accent"
                    )}
                  >
                    <button
                      onClick={() => handleSelectConversation(conv)}
                      className="w-full text-left px-4 py-3 transition-colors hover:bg-accent/50"
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

                          {!conv.isLinked && (
                            <span className="inline-block text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                              Sin vincular
                            </span>
                          )}

                          <p className="text-xs text-muted-foreground truncate mt-1">
                            {conv.lastMessage.direction === "outbound" && "→ "}
                            {truncate(conv.lastMessage.text, 60)}
                          </p>
                        </div>

                        <div className="shrink-0 mt-1 flex items-center gap-1">
                          {conv.unreadCount > 0 && (
                            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Actions — visible on hover */}
                    <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                      {!conv.isLinked && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleOpenLink(conv.id)}
                          title="Vincular a un lead"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(conv)}
                        disabled={deletingId === conv.id}
                        title="Eliminar conversación"
                      >
                        {deletingId === conv.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
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
            {selectedConv ? (
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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {selectedConv.leadName}
                    </p>
                    {selectedConv.instagramHandle && (
                      <p className="text-xs text-muted-foreground truncate">
                        @{selectedConv.instagramHandle}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!selectedConv.isConnected && (
                      <span className="text-xs text-destructive mr-2">
                        Desconectado
                      </span>
                    )}

                    {selectedConv.isLinked ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(selectedConv)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar conversación
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5"
                          onClick={() => handleOpenLink(selectedConv.id)}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Vincular a lead
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(selectedConv)}
                          disabled={deletingId === selectedConv.id}
                        >
                          {deletingId === selectedConv.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Messages thread */}
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {selectedConv.isLinked ? (
                    <InstagramConversation
                      key={selectedConv.id}
                      leadId={selectedConv.leadId!}
                    />
                  ) : (
                    <UnlinkedMessagesView
                      messages={unlinkedMessages}
                      loading={loadingMessages}
                    />
                  )}
                </div>

                {/* Send input — only for linked conversations */}
                {selectedConv.isLinked && (
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
                      {sending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
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
    </DashboardLayout>
  );
}

/* ---------- unlinked messages view ---------- */

function UnlinkedMessagesView({
  messages,
  loading,
}: {
  messages: ConversationMessage[];
  loading: boolean;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "flex",
              i % 2 === 0 ? "justify-start" : "justify-end"
            )}
          >
            <Skeleton
              className={cn(
                "h-12 rounded-xl",
                i % 2 === 0 ? "w-3/4" : "w-1/2"
              )}
            />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">No se encontraron mensajes</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex",
            msg.direction === "outbound" ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
              msg.direction === "outbound"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted rounded-bl-sm"
            )}
          >
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
            <p
              className={cn(
                "text-[10px] mt-1 opacity-60",
                msg.direction === "outbound" ? "text-right" : "text-left"
              )}
            >
              {formatTime(msg.timestamp)}
            </p>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
