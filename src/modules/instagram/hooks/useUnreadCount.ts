"use client";

import * as React from "react";
import { createClient } from "@/infrastructure/database/client";

const POLL_INTERVAL_MS = 30_000;

let channelCounter = 0;

/**
 * Returns the count of unread Instagram messages and a reset function.
 *
 * Uses Supabase Realtime to listen for new INSTAGRAM_MESSAGE inserts
 * and increments the counter immediately. Also polls every 30s as a
 * fallback if Realtime is not available.
 *
 * @param enabled — false to skip subscription (e.g. on login pages)
 */
export function useUnreadCount(enabled = true) {
  const [count, setCount] = React.useState(0);
  const countRef = React.useRef<number>(0);
  const [initialLoading, setInitialLoading] = React.useState(true);

  // Fetch initial count
  const fetchCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/activities/unread");
      if (res.ok) {
        const data = await res.json();
        countRef.current = data.count ?? 0;
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

    // Fetch initial count
    fetchCount();

    const supabase = createClient();

    // Unique channel name per mount avoids collisions with React Strict Mode
    // (createBrowserClient caches the instance, so a reused name would return
    //  the stale channel from the first mount and fail to add callbacks)
    const channelName = `instagram-unread-${++channelCounter}`;

    // Try Realtime subscription
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
          filter: "type=eq.INSTAGRAM_MESSAGE",
        },
        () => {
          countRef.current += 1;
          setCount(countRef.current);
        }
      )
      .subscribe();

    // Fallback polling — also picks up any missed events
    const intervalId = setInterval(() => {
      fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      channel.unsubscribe();
      clearInterval(intervalId);
    };
  }, [enabled, fetchCount]);

  return { count, reset, initialLoading };
}
