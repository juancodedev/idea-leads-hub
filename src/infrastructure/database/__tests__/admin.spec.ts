/**
 * @jest-environment node
 */
const mockCreateClient = jest.fn((..._args: unknown[]) => ({ from: jest.fn() }));

jest.mock("@supabase/supabase-js", () => ({
  // lazy: jest.mock is hoisted above the const declaration
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { createAdminClient } from "../admin";

describe("createAdminClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("creates a service-role client without session persistence", () => {
    const client = createAdminClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "service-role-key",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    expect(client).toBe(mockCreateClient.mock.results[0].value);
  });

  it("throws a clear error when the Supabase URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    expect(() => createAdminClient()).toThrow("NEXT_PUBLIC_SUPABASE_URL");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("throws a clear error when the service role key is missing", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    expect(() => createAdminClient()).toThrow("SUPABASE_SERVICE_ROLE_KEY");
    expect(mockCreateClient).not.toHaveBeenCalled();
  });
});
