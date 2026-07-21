import { describe, it, expect } from "vitest";
import { calcWeekNumber, getMonday } from "@/lib/plans/dates";
import { effectiveWeek, groupBlocks } from "@/lib/export/planUtils";
import type { ExportSession, ExportExercise } from "@/lib/export/planUtils";

// ── getMonday ──────────────────────────────────────────────────────────────

describe("getMonday", () => {
  it("returns same date when already Monday", () => {
    expect(getMonday("2026-06-29")).toBe("2026-06-29"); // lunes
  });

  it("returns previous Monday for a Wednesday", () => {
    expect(getMonday("2026-07-01")).toBe("2026-06-29"); // miércoles → lunes de esa semana
  });

  it("returns previous Monday for a Sunday", () => {
    expect(getMonday("2026-07-05")).toBe("2026-06-29"); // domingo → lunes anterior
  });

  it("returns previous Monday for a Saturday", () => {
    expect(getMonday("2026-07-04")).toBe("2026-06-29"); // sábado → lunes anterior
  });

  it("handles week boundary correctly", () => {
    expect(getMonday("2026-07-06")).toBe("2026-07-06"); // lunes siguiente
  });
});

// ── calcWeekNumber ─────────────────────────────────────────────────────────

describe("calcWeekNumber", () => {
  const planStart = "2026-06-29"; // lunes

  it("returns 1 for a session on the same week as plan start", () => {
    expect(calcWeekNumber("2026-06-29", planStart)).toBe(1);
  });

  it("returns 1 for any day in the first week", () => {
    expect(calcWeekNumber("2026-07-03", planStart)).toBe(1); // viernes semana 1
    expect(calcWeekNumber("2026-07-05", planStart)).toBe(1); // domingo semana 1
  });

  it("returns 2 for July 8 (the real bug case)", () => {
    // Sesión del 8-Jul tenía week_number=1 en DB pero cae en semana 2
    expect(calcWeekNumber("2026-07-08", planStart)).toBe(2);
  });

  it("returns 2 for any day in the second week", () => {
    expect(calcWeekNumber("2026-07-06", planStart)).toBe(2); // lunes semana 2
    expect(calcWeekNumber("2026-07-12", planStart)).toBe(2); // domingo semana 2
  });

  it("returns 3 for the third week", () => {
    expect(calcWeekNumber("2026-07-13", planStart)).toBe(3);
  });

  it("returns 1 when planStartDate is null", () => {
    expect(calcWeekNumber("2026-07-08", null)).toBe(1);
  });

  it("handles plan starting on non-Monday (normalizes to Monday)", () => {
    // Plan starts Wednesday 2026-07-01 → normalized to Monday 2026-06-29
    expect(calcWeekNumber("2026-07-08", "2026-07-01")).toBe(2);
  });
});

// ── effectiveWeek ──────────────────────────────────────────────────────────

describe("effectiveWeek", () => {
  const planStart = "2026-06-29";

  function session(overrides: Partial<ExportSession>): ExportSession {
    return { id: 1, week_number: 99, day_name: null, date: null, order_index: 0, ...overrides };
  }

  it("uses date when both date and planStartDate are present", () => {
    const s = session({ date: "2026-07-08", week_number: 1 });
    expect(effectiveWeek(s, planStart)).toBe(2); // el bug case
  });

  it("falls back to week_number when session has no date", () => {
    const s = session({ date: null, week_number: 3 });
    expect(effectiveWeek(s, planStart)).toBe(3);
  });

  it("falls back to week_number when planStartDate is null", () => {
    const s = session({ date: "2026-07-08", week_number: 5 });
    expect(effectiveWeek(s, null)).toBe(5);
  });

  it("returns 1 for a session on plan start date", () => {
    const s = session({ date: "2026-06-29", week_number: 99 });
    expect(effectiveWeek(s, planStart)).toBe(1);
  });
});

// ── groupBlocks ────────────────────────────────────────────────────────────

describe("groupBlocks", () => {
  function ex(overrides: Partial<ExportExercise> & { id: number }): ExportExercise {
    return {
      session_id: 1,
      order_index: overrides.id,
      superset_group: null,
      target_sets: 3,
      target_reps: null,
      target_weight: null,
      target_rpe: null,
      rest_seconds: null,
      coach_notes: null,
      actual_sets: null,
      actual_reps: null,
      actual_weight: null,
      actual_rpe: null,
      student_notes: null,
      ...overrides,
    };
  }

  it("returns standalone blocks with letter=null", () => {
    const exercises = [ex({ id: 1 }), ex({ id: 2 })];
    const blocks = groupBlocks(exercises);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].letter).toBeNull();
    expect(blocks[1].letter).toBeNull();
  });

  it("groups superset exercises under the same letter", () => {
    const exercises = [
      ex({ id: 1, superset_group: 10 }),
      ex({ id: 2, superset_group: 10 }),
    ];
    const blocks = groupBlocks(exercises);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].letter).toBe("A");
    expect(blocks[0].items).toHaveLength(2);
  });

  it("assigns sequential letters to different supersets", () => {
    const exercises = [
      ex({ id: 1, superset_group: 10 }),
      ex({ id: 2, superset_group: 10 }),
      ex({ id: 3 }),
      ex({ id: 4, superset_group: 20 }),
      ex({ id: 5, superset_group: 20 }),
    ];
    const blocks = groupBlocks(exercises);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].letter).toBe("A");
    expect(blocks[0].items).toHaveLength(2);
    expect(blocks[1].letter).toBeNull();
    expect(blocks[1].items).toHaveLength(1);
    expect(blocks[2].letter).toBe("B");
    expect(blocks[2].items).toHaveLength(2);
  });

  it("sorts exercises by order_index before grouping", () => {
    const exercises = [
      ex({ id: 3, order_index: 3 }),
      ex({ id: 1, order_index: 1, superset_group: 10 }),
      ex({ id: 2, order_index: 2, superset_group: 10 }),
    ];
    const blocks = groupBlocks(exercises);
    // Superset comes first (order_index 1 and 2), standalone last (order_index 3)
    expect(blocks[0].letter).toBe("A");
    expect(blocks[1].letter).toBeNull();
  });

  it("returns empty array for empty input", () => {
    expect(groupBlocks([])).toHaveLength(0);
  });

  it("handles a single superset entry (solo group)", () => {
    const exercises = [ex({ id: 1, superset_group: 5 })];
    const blocks = groupBlocks(exercises);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].letter).toBe("A");
    expect(blocks[0].items).toHaveLength(1);
  });
});
