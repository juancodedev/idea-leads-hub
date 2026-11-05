-- Enable Realtime publication for the activities table
-- This allows the client to subscribe to INSERT events on activities
-- and show real-time unread message badges in the sidebar.

ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
