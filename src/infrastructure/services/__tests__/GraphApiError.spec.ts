/**
 * @jest-environment node
 */
import { GraphApiError } from "../GraphApiError";

describe("GraphApiError", () => {
  it("keeps the message and exposes status, code, subcode and type", () => {
    const error = new GraphApiError("Failed to send Instagram DM: Invalid token", {
      status: 401,
      code: 190,
      subcode: 463,
      type: "OAuthException",
    });

    expect(error.message).toBe("Failed to send Instagram DM: Invalid token");
    expect(error).toMatchObject({
      name: "GraphApiError",
      status: 401,
      code: 190,
      subcode: 463,
      type: "OAuthException",
    });
  });

  it("is an Error and a GraphApiError", () => {
    const error = new GraphApiError("boom", { status: 500 });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(GraphApiError);
  });

  it("defaults missing Graph fields to null", () => {
    const error = new GraphApiError("boom", { status: 502 });

    expect(error).toMatchObject({ status: 502, code: null, subcode: null, type: null });
  });
});
