import { describe, expect, it } from "vitest";
import { compareActivityNewestFirst } from "../../../src/v2/domain/activity-order";
import { parseCalendarDate } from "../../../src/v2/domain/calendar";

const activity = (
  id: string,
  date: string,
  createdAt: string,
  activityKind = "expense",
) => ({
  id,
  activityDate: parseCalendarDate(date),
  activityKind,
  createdAt,
  updatedAt: createdAt,
});

describe("activity ordering", () => {
  it("shows the newest creation first when transactions share a date", () => {
    const older = activity(
      "older-$8.44",
      "2026-10-23",
      "2026-10-23T14:00:00.000Z",
    );
    const newer = activity(
      "newer-$16.10",
      "2026-10-23",
      "2026-10-23T14:05:00.000Z",
    );

    expect(
      [older, newer].sort(compareActivityNewestFirst).map(({ id }) => id),
    ).toEqual(["newer-$16.10", "older-$8.44"]);
  });

  it("uses deterministic kind and ID fallbacks for legacy timestamps", () => {
    const records = [
      activity("z", "2026-10-23", "not-a-date", "income"),
      activity("b", "2026-10-23", "", "expense"),
      activity("a", "2026-10-23", "", "expense"),
    ];

    expect(
      records.sort(compareActivityNewestFirst).map(({ id }) => id),
    ).toEqual(["a", "b", "z"]);
  });

  it("keeps the original creation timestamp authoritative after an edit", () => {
    const editedOlder = {
      ...activity("older", "2026-10-23", "2026-10-23T14:00:00.000Z"),
      updatedAt: "2026-10-23T16:00:00.000Z",
    };
    const newer = activity("newer", "2026-10-23", "2026-10-23T15:00:00.000Z");

    expect(
      [editedOlder, newer].sort(compareActivityNewestFirst).map(({ id }) => id),
    ).toEqual(["newer", "older"]);
  });
});
