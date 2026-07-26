"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bell, MessageCircle, CheckSquare, ArrowRight } from "lucide-react";
import { Button } from "@/ui/components/button";
import Link from "next/link";
import { useUnreadCount } from "@/modules/instagram/hooks/useUnreadCount";

interface NotificationSummary {
  unreadMessages: number;
  pendingActivities: number;
  overdueActivities: number;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<NotificationSummary>({
    unreadMessages: 0,
    pendingActivities: 0,
    overdueActivities: 0,
  });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { count: msgCount } = useUnreadCount(true);

  // Fetch pending/overdue activities count
  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch("/api/activities/summary");
        if (res.ok) {
          const data = await res.json();
          setSummary((prev) => ({ ...prev, ...data }));
        }
      } catch {
        // silent
      }
    }
    fetchSummary();
  }, []);

  // Sync msg count from hook
  useEffect(() => {
    setSummary((prev) => ({ ...prev, unreadMessages: msgCount }));
  }, [msgCount]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const total = summary.unreadMessages + summary.pendingActivities + summary.overdueActivities;

  return (
    <div ref={dropdownRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {total > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-card shadow-lg z-50">
          <div className="p-3 border-b">
            <h4 className="text-sm font-semibold">Notificaciones</h4>
          </div>

          <div className="p-2 space-y-1">
            <Link
              href="/messages"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-blue-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Mensajes de Instagram</p>
                <p className="text-xs text-muted-foreground">
                  {summary.unreadMessages > 0
                    ? `${summary.unreadMessages} sin leer`
                    : "No hay mensajes nuevos"}
                </p>
              </div>
              {summary.unreadMessages > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full h-5 min-w-5 flex items-center justify-center px-1">
                  {summary.unreadMessages}
                </span>
              )}
            </Link>

            <Link
              href="/activities"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <CheckSquare className="h-4 w-4 text-orange-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Actividades pendientes</p>
                <p className="text-xs text-muted-foreground">
                  {summary.pendingActivities > 0
                    ? `${summary.pendingActivities} pendientes`
                    : "Todo al día"}
                </p>
              </div>
              {summary.pendingActivities > 0 && (
                <span className="text-xs text-muted-foreground">
                  {summary.overdueActivities > 0 && (
                    <span className="text-red-500">
                      {summary.overdueActivities} vencidas
                    </span>
                  )}
                </span>
              )}
            </Link>
          </div>

          <div className="p-2 border-t">
            <Link
              href="/activities"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1"
            >
              Ver todas
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
