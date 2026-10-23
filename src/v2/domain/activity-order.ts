import type { CalendarDate, EntityMetadata } from "./types";

export type DatedActivityForOrdering = EntityMetadata &
  Readonly<{
    id: string;
    activityDate: CalendarDate;
    activityKind: string;
  }>;

const creationTime = (createdAt: string): number => {
  const parsed = Date.parse(createdAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

/**
 * Orders activity by its financial date, then by its immutable creation time.
 * The kind and ID tie-breakers keep legacy records with missing/invalid
 * timestamps stable across reloads and account filters.
 */
export function compareActivityNewestFirst(
  left: DatedActivityForOrdering,
  right: DatedActivityForOrdering,
): number {
  const dateOrder = right.activityDate.localeCompare(left.activityDate);
  if (dateOrder !== 0) return dateOrder;

  const leftCreated = creationTime(left.createdAt);
  const rightCreated = creationTime(right.createdAt);
  if (leftCreated !== rightCreated) return rightCreated > leftCreated ? 1 : -1;

  const kindOrder = left.activityKind.localeCompare(right.activityKind);
  if (kindOrder !== 0) return kindOrder;
  return left.id.localeCompare(right.id);
}
