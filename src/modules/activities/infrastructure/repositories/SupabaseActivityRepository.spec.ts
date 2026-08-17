/**
 * Implementation-level spec for SupabaseActivityRepository (tasks 4.1/4.2).
 *
 * Mocks the Supabase client query chain (rows + fluent builder), NOT the
 * repository — every test exercises the real production code (dual-write
 * payloads, filters, guards) and asserts the exact persistence contract.
 */

import { SupabaseActivityRepository } from "./SupabaseActivityRepository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/infrastructure/database/database.types";
import { ActivityType } from "../../domain/enums/ActivityType";
import { ActivityStatus } from "../../domain/enums/ActivityStatus";
import { NotFoundError } from "@/infrastructure/repositories/errors";

// ---------- Mocks ----------
const mockFrom = jest.fn();
const mockGetUser = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockInsert = jest.fn();
const mockIs = jest.fn();
const mockIlike = jest.fn();
const mockIn = jest.fn();
const mockOr = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();

const fakeSupabase = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
} as unknown as SupabaseClient<Database>;

// Fluent chain: every filter method returns the same builder; terminal
// awaits resolve through `single` (row verbs) or the thenable builder
// (search / getUnreadCount, which await the query directly).
const mockChain = {
  update: mockUpdate,
  eq: mockEq,
  select: mockSelect,
  single: mockSingle,
  insert: mockInsert,
  is: mockIs,
  ilike: mockIlike,
  in: mockIn,
  or: mockOr,
  order: mockOrder,
  range: mockRange,
  // Thenable: search / getUnreadCount await the query builder directly. Per
  // Promise resolution semantics, `then` must invoke the resolve callback —
  // returning a promise from `then` is discarded and would hang the await.
  then: jest.fn((resolve: (value: unknown) => void) =>
    resolve({ data: [], error: null, count: 0 })
  ),
};

const baseRow = {
  id: "act-1",
  user_id: "user-1",
  lead_id: null,
  idea_id: null,
  type: ActivityType.TASK,
  title: "Test activity",
  description: "",
  due_date: null,
  status: ActivityStatus.PENDING,
  completed: false,
  completed_at: null,
  read_at: null,
  attachments: [],
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

const igRow = { ...baseRow, type: ActivityType.INSTAGRAM_MESSAGE };

beforeEach(() => {
  jest.clearAllMocks();
  mockFrom.mockReturnValue(mockChain);
  mockUpdate.mockReturnValue(mockChain);
  mockEq.mockReturnValue(mockChain);
  mockSelect.mockReturnValue(mockChain);
  mockInsert.mockReturnValue(mockChain);
  mockIs.mockReturnValue(mockChain);
  mockIlike.mockReturnValue(mockChain);
  mockIn.mockReturnValue(mockChain);
  mockOr.mockReturnValue(mockChain);
  mockOrder.mockReturnValue(mockChain);
  mockRange.mockReturnValue(mockChain);
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mockSingle.mockResolvedValue({ data: baseRow, error: null });
  mockChain.then.mockImplementation((resolve: (value: unknown) => void) =>
    resolve({ data: [], error: null, count: 0 })
  );
});

function createRepo() {
  return new SupabaseActivityRepository(fakeSupabase);
}

describe("SupabaseActivityRepository.moveStatus (BR-4 dual-write + BR-6 completed_at)", () => {
  it("should dual-write completed=true and stamp completed_at when moving to COMPLETED", async () => {
    mockSingle.mockResolvedValue({
      data: { ...baseRow, status: ActivityStatus.COMPLETED, completed: true, completed_at: "2024-06-01T10:00:00Z" },
      error: null,
    });

    const repo = createRepo();
    const result = await repo.moveStatus("act-1", ActivityStatus.COMPLETED);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ActivityStatus.COMPLETED,
        completed: true,
        completed_at: expect.any(String),
      })
    );
    expect(mockEq).toHaveBeenCalledWith("id", "act-1");
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(result.completed).toBe(true);
    expect(result.completedAt).toEqual(new Date("2024-06-01T10:00:00Z"));
  });

  it("should dual-write completed=false and clear completed_at when leaving COMPLETED", async () => {
    mockSingle.mockResolvedValue({
      data: { ...baseRow, status: ActivityStatus.PENDING, completed: false, completed_at: null },
      error: null,
    });

    const repo = createRepo();
    const result = await repo.moveStatus("act-1", ActivityStatus.PENDING);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ActivityStatus.PENDING,
        completed: false,
        completed_at: null,
      })
    );
    // BR-3: a status transition must never touch read_at.
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty("read_at");
    expect(result.status).toBe(ActivityStatus.PENDING);
    expect(result.completed).toBe(false);
  });
});

describe("SupabaseActivityRepository.markRead / markUnread (BR-3 guard + only read_at)", () => {
  it("should update ONLY read_at and scope the write to INSTAGRAM_MESSAGE rows", async () => {
    mockSingle.mockResolvedValue({
      data: { ...igRow, read_at: "2024-06-01T10:00:00Z" },
      error: null,
    });

    const repo = createRepo();
    const result = await repo.markRead("act-1");

    const payload = mockUpdate.mock.calls[0][0];
    expect(payload).toHaveProperty("read_at", expect.any(String));
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("completed");
    // BR-3 type guard: the update refuses non-INSTAGRAM_MESSAGE rows at the DB level.
    expect(mockEq).toHaveBeenCalledWith("type", ActivityType.INSTAGRAM_MESSAGE);
    expect(result.readAt).toEqual(new Date("2024-06-01T10:00:00Z"));
  });

  it("should refuse (404) when no INSTAGRAM_MESSAGE row matches the guarded update", async () => {
    // A TASK row: the .eq('type', INSTAGRAM_MESSAGE) filter matches 0 rows and
    // .single() surfaces PGRST116 → NotFoundError.
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "The result contains 0 rows" },
    });

    const repo = createRepo();
    await expect(repo.markRead("act-1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("should clear ONLY read_at and scope the write to INSTAGRAM_MESSAGE rows", async () => {
    mockSingle.mockResolvedValue({ data: { ...igRow, read_at: null }, error: null });

    const repo = createRepo();
    const result = await repo.markUnread("act-1");

    const payload = mockUpdate.mock.calls[0][0];
    expect(payload).toHaveProperty("read_at", null);
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("completed");
    expect(mockEq).toHaveBeenCalledWith("type", ActivityType.INSTAGRAM_MESSAGE);
    expect(result.readAt).toBeUndefined();
  });
});

describe("SupabaseActivityRepository.getUnreadCount (BR-3 read marker)", () => {
  it("should count INSTAGRAM_MESSAGE rows with read_at IS NULL, scoped by user", async () => {
    mockChain.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [], error: null, count: 7 }));

    const repo = createRepo();
    const count = await repo.getUnreadCount("user-1");

    expect(mockSelect).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(mockEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockEq).toHaveBeenCalledWith("type", ActivityType.INSTAGRAM_MESSAGE);
    expect(mockIs).toHaveBeenCalledWith("read_at", null);
    expect(count).toBe(7);
  });
});

describe("SupabaseActivityRepository.search default filter (PENDING includes NULL status)", () => {
  it("should treat rows with status IS NULL as PENDING in the default pending list", async () => {
    mockChain.then.mockImplementation((resolve: (value: unknown) => void) =>
      resolve({ data: [baseRow], error: null, count: 1 }));

    const repo = createRepo();
    const result = await repo.search({ userId: "user-1" });

    expect(mockOr).toHaveBeenCalledWith("status.in.(PENDING,IN_PROGRESS),status.is.null");
    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].status).toBe(ActivityStatus.PENDING);
  });

  it("should filter by an explicit statusIn list when provided", async () => {
    const repo = createRepo();
    await repo.search({ userId: "user-1", statusIn: [ActivityStatus.COMPLETED] });

    expect(mockIn).toHaveBeenCalledWith("status", [ActivityStatus.COMPLETED]);
    expect(mockOr).not.toHaveBeenCalled();
  });

  it("should fall back to the legacy completed alias when statusIn is absent", async () => {
    const repo = createRepo();
    await repo.search({ userId: "user-1", completed: false });

    expect(mockEq).toHaveBeenCalledWith("completed", false);
    expect(mockOr).not.toHaveBeenCalled();
  });
});

describe("SupabaseActivityRepository.create normalization (BR-4)", () => {
  it("should normalize legacy completed:true to status=COMPLETED and dual-write", async () => {
    mockSingle.mockResolvedValue({
      data: { ...baseRow, status: ActivityStatus.COMPLETED, completed: true },
      error: null,
    });

    const repo = createRepo();
    await repo.create({ title: "Task", type: ActivityType.TASK, completed: true });

    expect(mockGetUser).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: ActivityStatus.COMPLETED,
          completed: true,
          user_id: "user-1",
        }),
      ])
    );
  });

  it("should never write a raw completed contradicting an explicit status", async () => {
    const repo = createRepo();
    // Caller error: completed:true paired with status=PENDING — status wins,
    // so the persisted row must NOT carry completed=true (BR-4 invariant).
    await repo.create({ title: "Task", type: ActivityType.TASK, status: ActivityStatus.PENDING, completed: true });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: ActivityStatus.PENDING, completed: false }),
      ])
    );
  });

  it("should default to PENDING when neither status nor completed is provided", async () => {
    const repo = createRepo();
    await repo.create({ title: "Task", type: ActivityType.TASK });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ status: ActivityStatus.PENDING, completed: false }),
      ])
    );
  });
});

describe("SupabaseActivityRepository.complete delegation (status surface)", () => {
  it("should delegate to moveStatus(COMPLETED) so the dual-write invariant holds", async () => {
    mockSingle.mockResolvedValue({
      data: { ...baseRow, status: ActivityStatus.COMPLETED, completed: true, completed_at: "2024-06-01T10:00:00Z" },
      error: null,
    });

    const repo = createRepo();
    const result = await repo.complete("act-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ActivityStatus.COMPLETED,
        completed: true,
        completed_at: expect.any(String),
      })
    );
    expect(result.status).toBe(ActivityStatus.COMPLETED);
    expect(result.completed).toBe(true);
  });
});