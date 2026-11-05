"use client";

import * as React from "react";
import { createClient } from "@/infrastructure/database/client";

const POLL_INTERVAL_MS = 30_000;

let channelCounter = 0;

/**
 * Returns the count of unread Instagram messages and a reset function.
 *
 * The count is the sum of `conversations.unread_count` (S12). Supabase
 * Realtime INSERT/UPDATE events on the user's conversations trigger a
 * refetch (ADR-11); polling every 30s is the fallback when Realtime is not
 * available.
 *
 * @param enabled — false to skip subscription (e.g. on login pages)
 */
export function useUnreadCount(enabled = true) {
  const [count, setCount] = React.useState(0);
  const [initialLoading, setInitialLoading] = React.useState(true);

  // Fetch the current count
  const fetchCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/activities/unread");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // Silent — will retry on poll
    } finally {
      setInitialLoading(false);
    }
  }, []);

  // Reset count to fresh value (used when opening messages page)
  const reset = React.useCallback(() => {
    fetchCount();
  }, [fetchCount]);

  // ── Realtime subscription + polling ──────────────────────────────
  React.useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let channel: { unsubscribe: () => unknown } | null = null;

    fetchCount();

    const supabase = createClient();

    // Unique channel name per mount avoids collisions with React Strict Mode
    // (createBrowserClient caches the instance, so a reused name would return
    //  the stale channel from the first mount and fail to add callbacks)
    const channelName = `instagram-unread-${++channelCounter}`;

    supabase.auth
      .getUser()
      .then(({ data }) => {
        const userId = data?.user?.id;
        if (cancelled || !userId) return;
        const filter = `user_id=eq.${userId}`;
        channel = supabase
          .channel(channelName)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "conversations", filter },
            () => fetchCount()
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "conversations", filter },
            () => fetchCount()
          )
          .subscribe();
      })
      .catch(() => {
        // Realtime unavailable — polling still keeps the badge fresh
      });

    // Fallback polling — also picks up any missed events
    const intervalId = setInterval(() => {
      fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      channel?.unsubscribe();
      clearInterval(intervalId);
    };
  }, [enabled, fetchCount]);

  return { count, reset, initialLoading };
}
