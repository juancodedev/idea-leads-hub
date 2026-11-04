export function toDate(value: string): Date {
  return new Date(value);
}

export function toDateOrNull(value: string | null | undefined): Date | null {
  return value ? new Date(value) : null;
}

export function toIsoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
