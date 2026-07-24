-- Link orphan inbound Instagram messages to leads
--
-- When the webhook receives an inbound DM but cannot find a lead by
-- instagram_scoped_id, the activity is saved with lead_id = null, while
-- outbound replies to the same user are properly linked. This migration
-- retroactively links orphan inbound messages by matching sender IDs
-- with existing linked activities from the same conversation.
--
-- The fix in the webhook (route.ts) prevents this going forward, but
-- existing orphan messages need this one-time backfill.

UPDATE activities a
SET lead_id = (
  SELECT b.lead_id
  FROM activities b
  WHERE b.lead_id IS NOT NULL
    AND b.type = 'INSTAGRAM_MESSAGE'
    AND (
      -- Match by senderId extracted from "Instagram DM to {senderId}"
      b.title = 'Instagram DM to ' || substr(a.title, 18)
      OR
      -- Also match by "Instagram DM from {senderId}" (another inbound that was linked)
      b.title = 'Instagram DM from ' || substr(a.title, 18)
    )
  LIMIT 1
)
WHERE a.lead_id IS NULL
  AND a.type = 'INSTAGRAM_MESSAGE'
  AND a.title LIKE 'Instagram DM from %';

-- Verify: count how many were updated
DO $$
DECLARE
  updated_count INTEGER;
  remaining_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  SELECT COUNT(*) INTO remaining_count
  FROM activities
  WHERE lead_id IS NULL
    AND type = 'INSTAGRAM_MESSAGE'
    AND title LIKE 'Instagram DM from %';

  RAISE NOTICE 'Linked % orphan inbound messages', updated_count;
  RAISE NOTICE 'Remaining unlinked: % (no matching outbound activity found)', remaining_count;
END $$;
