/**
 * @jest-environment node
 */

jest.mock("@/lib/api/cors", () => ({
  handlePreflight: jest.fn(() => null),
  withCors: jest.fn((response: Response) => response),
}));

import { NextRequest } from "next/server";
import { GET } from "../openapi.json/route";

describe("GET /api/docs/openapi.json", () => {
  it("should document the ActivityStatus enum and status/read/unread surface", async () => {
    const request = new NextRequest("http://localhost:3000/api/docs/openapi.json");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);

    // ActivityStatus enum documented.
    expect(body.components.schemas.ActivityStatus).toBeDefined();
    expect(body.components.schemas.ActivityStatus.enum).toEqual([
      "PENDING",
      "IN_PROGRESS",
      "COMPLETED",
    ]);

    // New endpoints documented under Activities.
    const activitiesPaths = Object.keys(body.paths).filter((p) =>
      p.startsWith("/api/activities")
    );
    expect(activitiesPaths).toContain("/api/activities/{id}/status");
    expect(activitiesPaths).toContain("/api/activities/{id}/read");
    expect(activitiesPaths).toContain("/api/activities/unread");

    // Activity schema: status + read_at added, completed marked deprecated
    // (kept during rollout — removal deferred to the column drop).
    const activitySchema = body.components.schemas.Activity.properties;
    expect(activitySchema.status).toBeDefined();
    expect(activitySchema.readAt).toBeDefined();
    expect(activitySchema.completed.deprecated).toBe(true);
  });

  it("should document the messaging surface (S11): endpoints and Conversation, Message, SendOutcome schemas", async () => {
    const response = await GET(new NextRequest("http://localhost:3000/api/docs/openapi.json"));
    const body = await response.json();
    const { paths, components } = body;

    // Every endpoint added or modified by the messaging pipeline.
    expect(paths["/api/instagram/send"].post).toBeDefined();
    expect(paths["/api/leads/{id}/instagram/send"].post).toBeDefined();
    expect(paths["/api/instagram/conversations"].get).toBeDefined();
    expect(paths["/api/leads/{id}/instagram/conversation"].get).toBeDefined();
    expect(paths["/api/messages"].get).toBeDefined();
    expect(paths["/api/messages"].delete).toBeDefined();
    expect(paths["/api/messages"].patch).toBeDefined();
    expect(paths["/api/messages/read"].patch).toBeDefined();
    expect(paths["/api/activities/unread"].get).toBeDefined();
    expect(paths["/api/webhook/instagram"].post.responses[401]).toBeDefined();

    // Sweep documented with its 401 response.
    expect(paths["/api/webhook/instagram/sweep"].get.responses[401]).toBeDefined();

    // Send failures: 502 with { error, hint }.
    for (const path of ["/api/instagram/send", "/api/leads/{id}/instagram/send"]) {
      const failure = paths[path].post.responses[502].content["application/json"].schema;
      expect(failure.$ref).toBe("#/components/schemas/SendFailure");
    }
    expect(components.schemas.SendFailure.required).toEqual(["error", "hint"]);

    // PATCH /api/messages/read takes { key }.
    const readBody = paths["/api/messages/read"].patch.requestBody.content["application/json"].schema;
    expect(readBody.required).toEqual(["key"]);

    // Messaging schemas.
    expect(Object.keys(components.schemas.Conversation.properties)).toEqual(
      expect.arrayContaining(["id", "conversationIds", "leadId", "lastMessage", "unreadCount", "isLinked"])
    );
    expect(Object.keys(components.schemas.Message.properties)).toEqual(
      expect.arrayContaining(["id", "text", "direction", "timestamp", "status", "errorMessage", "hint"])
    );
    expect(components.schemas.SendOutcome.oneOf).toHaveLength(2);
    expect(paths["/api/leads/{id}/instagram/conversation"].get.responses[200].content["application/json"].schema.items.$ref).toBe(
      "#/components/schemas/Message"
    );
  });

  it("should document API-key auth, lead upsert and the integration fields", async () => {
    const request = new NextRequest("http://localhost:3000/api/docs/openapi.json");
    const response = await GET(request);
    const body = await response.json();

    // Machine auth scheme.
    expect(body.components.securitySchemes.apiKeyAuth).toBeDefined();
    expect(body.components.securitySchemes.apiKeyAuth.name).toBe("X-API-Key");

    // Leads read/write accept the API key; DELETE stays session-only.
    expect(body.paths["/api/leads"].get.security).toContainEqual({ apiKeyAuth: [] });
    expect(body.paths["/api/leads"].post.security).toContainEqual({ apiKeyAuth: [] });
    expect(body.paths["/api/leads/{id}"].get.security).toContainEqual({ apiKeyAuth: [] });
    expect(body.paths["/api/leads/{id}"].patch.security).toContainEqual({ apiKeyAuth: [] });
    expect(JSON.stringify(body.paths["/api/leads/{id}"].delete.security)).not.toContain("apiKeyAuth");

    // Upsert contract.
    expect(body.paths["/api/leads"].post.responses[200]).toBeDefined();
    expect(body.paths["/api/leads"].post.responses[201]).toBeDefined();

    // Canonical English fields + deprecated Spanish aliases.
    const createLead = body.components.schemas.CreateLeadRequest;
    expect(createLead.properties.externalId).toBeDefined();
    expect(createLead.properties.city).toBeDefined();
    expect(createLead.properties.industry).toBeDefined();
    expect(createLead.properties.opportunityScore).toBeDefined();
    expect(createLead.properties.rating).toBeDefined();
    expect(createLead.properties.reviewsCount).toBeDefined();
    expect(createLead.required).toBeUndefined();
    expect(createLead.properties.empresa.deprecated).toBe(true);
    expect(createLead.properties.email.description).toContain("Opcional");

    // Email is optional in the response and the new fields are returned.
    const lead = body.components.schemas.Lead.properties;
    expect(lead.email.nullable).toBe(true);
    expect(lead.externalId).toBeDefined();
    expect(lead.opportunityScore).toBeDefined();

    // Key management surface.
    expect(body.paths["/api/auth/api-keys"]).toBeDefined();
    expect(body.paths["/api/auth/api-keys/{id}"]).toBeDefined();
    expect(body.paths["/api/leads/search"]).toBeDefined();
  });
});
