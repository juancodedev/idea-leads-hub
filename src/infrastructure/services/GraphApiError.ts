export interface GraphApiErrorDetails {
  /** HTTP status of the Graph response. */
  status: number;
  /** Graph `error.code`, when the body carried one. */
  code?: number | null;
  /** Graph `error.error_subcode`, when the body carried one. */
  subcode?: number | null;
  /** Graph `error.type` (e.g. `OAuthException`), when the body carried one. */
  type?: string | null;
}

/**
 * A non-OK Meta Graph API response (ADR-8). Keeps the human-readable message
 * callers already match on and adds the structured fields adapters map from.
 */
export class GraphApiError extends Error {
  readonly status: number;
  readonly code: number | null;
  readonly subcode: number | null;
  readonly type: string | null;

  constructor(message: string, details: GraphApiErrorDetails) {
    super(message);
    this.name = "GraphApiError";
    this.status = details.status;
    this.code = details.code ?? null;
    this.subcode = details.subcode ?? null;
    this.type = details.type ?? null;
    Object.setPrototypeOf(this, GraphApiError.prototype);
  }
}
