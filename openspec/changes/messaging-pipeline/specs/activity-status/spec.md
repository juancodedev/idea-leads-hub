# Delta for activity-status

## MODIFIED Requirements

### Requirement: Read/completed decoupling (BR-3)

The system MUST store Instagram read state per conversation (`conversations.unread_count`) and MUST
NOT let activity status transitions touch it. The unread badge MUST be the sum of `unread_count`
over the user's conversations. Marking a conversation read MUST set its `unread_count = 0` and MUST
also set `read_at` on that participant's unread legacy `INSTAGRAM_MESSAGE` activities, so a code
rollback shows the same read state. Status transitions on legacy activities MUST NOT change
`unread_count`. Marking an inbound legacy activity read or unread through the existing activity
endpoints MUST decrement (never below 0) or increment the `unread_count` of its linked conversation,
only when its `read_at` actually changes.

(Previously: the badge counted `INSTAGRAM_MESSAGE` activities with `read_at IS NULL`, and read state
lived only on activities.)

#### Scenario: Badge counts conversations

- GIVEN two conversations with `unread_count` 2 and 1
- WHEN the badge loads
- THEN it shows 3

#### Scenario: Reading a conversation

- GIVEN a conversation with `unread_count = 2` and 2 unread legacy activities
- WHEN the user opens and marks it read
- THEN `unread_count = 0`, both legacy activities have `read_at` set, and the badge decreases by 2

#### Scenario: Activity-level read keeps the badge in sync

- GIVEN a conversation with `unread_count = 2` and its two unread linked legacy activities
- WHEN one activity is marked read through `PATCH /api/activities/[id]/read`, and then marked read again
- THEN `unread_count = 1` after the first call and stays 1 after the second

#### Scenario: Completing a legacy activity does not mark read

- GIVEN an unread legacy `INSTAGRAM_MESSAGE` activity
- WHEN its status changes to `COMPLETED`
- THEN the conversation `unread_count` is unchanged
