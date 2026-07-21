import ExcelJS from "exceljs";
import { getMonday } from "@/lib/plans/dates";
import { effectiveWeek, groupBlocks } from "./planUtils";
import type { ExportSession, ExportExercise } from "./planUtils";

export type { ExportSession, ExportExercise } from "./planUtils";

// ARGB constants
const BLK = "FF09090B";
const WHT = "FFFFFFFF";
const YEL = "FFFBBF24";
const AMB = "FFFBBF24";
const STU_CLR = "FFD4D4D8";
const GRY = "FFF4F4F5";
const ALT = "FFFAFAFA";
const SST_BG = "FFFEF9C3";
const SST_TXT = "FF92400E";
const STU_FILL = "FFF0FDF4";
const STU_EMPTY = "FFF9FAFB";
const STU_TXT = "FF166534";

function rpeArgb(rpe: number | null): string | null {
  if (rpe === null || rpe === undefined) return null;
  if (rpe <= 6) return "FF86EFAC";
  if (rpe === 7) return "FFFDE68A";
  if (rpe === 8) return "FFFDBA74";
  if (rpe === 9) return "FFFCA5A5";
  return "FFF87171";
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

type BorderSide = { style: ExcelJS.BorderStyle; color: { argb: string } };
function thinBorder(argb = "FFD4D4D8"): BorderSide {
  return { style: "thin", color: { argb } };
}
function stdBorder(): Partial<ExcelJS.Borders> {
  const b = thinBorder();
  return { top: b, left: b, bottom: b, right: b };
}

function applyStyle(
  cell: ExcelJS.Cell,
  opts: {
    fill?: ExcelJS.Fill;
    font?: Partial<ExcelJS.Font>;
    align?: Partial<ExcelJS.Alignment>;
    border?: Partial<ExcelJS.Borders>;
  }
) {
  if (opts.fill) cell.fill = opts.fill;
  if (opts.font) cell.font = opts.font;
  if (opts.align) cell.alignment = opts.align;
  if (opts.border) cell.border = opts.border;
}

function getMondayStr(planStart: string | null, week: number): string {
  if (!planStart) return "";
  const d = new Date(getMonday(planStart) + "T00:00:00");
  d.setDate(d.getDate() + (week - 1) * 7);
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "numeric" });
}

function fmtSessionDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export async function buildPlanWorkbook(params: {
  planName: string;
  studentName: string;
  planStartDate: string | null;
  sessions: ExportSession[];
  exercisesBySession: Record<number, ExportExercise[]>;
}): Promise<ExcelJS.Workbook> {
  const { planName, studentName, planStartDate, sessions, exercisesBySession } = params;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BeeGym";
  workbook.created = new Date();

  const allEx = Object.values(exercisesBySession).flat();
  const maxSets = Math.max(1, ...allEx.map((e) => e.target_sets ?? 1));

  // Column index bounds
  // 1=Grupo, 2=Ejercicio
  // Coach: 3=S, 4..3+M=R, 4+M..3+2M=K, 4+2M=RPE, 5+2M=Pausa, 6+2M=Obs
  // Student: 7+2M=S, 8+2M..7+3M=R, 8+3M..7+4M=K, 8+4M=RPE, 9+4M=Obs
  const TOTAL_COLS = 9 + 4 * maxSets;
  const COACH_START = 3;
  const COACH_END = 6 + 2 * maxSets;
  const STU_START = COACH_END + 1;

  const byWeek = new Map<number, ExportSession[]>();
  for (const s of sessions) {
    const week = effectiveWeek(s, planStartDate);
    const arr = byWeek.get(week) ?? [];
    arr.push(s);
    byWeek.set(week, arr);
  }

  for (const [week, weekSessions] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    const ws = workbook.addWorksheet(`SEM ${week}`);

    // Column widths
    const colDefs: Partial<ExcelJS.Column>[] = [
      { width: 5 },
      { width: 30 },
      { width: 5 },
    ];
    for (let i = 0; i < maxSets; i++) colDefs.push({ width: 7 });
    for (let i = 0; i < maxSets; i++) colDefs.push({ width: 8 });
    colDefs.push({ width: 6 }, { width: 8 }, { width: 22 });
    colDefs.push({ width: 5 });
    for (let i = 0; i < maxSets; i++) colDefs.push({ width: 7 });
    for (let i = 0; i < maxSets; i++) colDefs.push({ width: 8 });
    colDefs.push({ width: 6 }, { width: 22 });
    ws.columns = colDefs;

    // ── Info header (rows 1–4) ──
    let rowN = 1;
    const infoRows: [string, string][] = [
      ["PLAN", planName.toUpperCase()],
      ["SEMANA", String(week)],
      ["FECHA", getMondayStr(planStartDate, week)],
      ["ALUMNO", studentName],
    ];

    for (const [label, val] of infoRows) {
      const r = ws.getRow(rowN);
      r.height = 18;

      applyStyle(ws.getCell(rowN, 1), {
        fill: solidFill("FFE4E4E7"),
        font: { bold: true, size: 8, color: { argb: "FF52525B" } },
        align: { horizontal: "right", vertical: "middle" },
        border: stdBorder(),
      });
      ws.getCell(rowN, 1).value = label;

      ws.getCell(rowN, 2).value = val;
      applyStyle(ws.getCell(rowN, 2), {
        fill: solidFill(GRY),
        font: { bold: true, size: label === "PLAN" ? 13 : 10, color: { argb: BLK } },
        align: { horizontal: "left", vertical: "middle" },
        border: stdBorder(),
      });
      ws.mergeCells(rowN, 2, rowN, 5);

      for (let c = 6; c <= TOTAL_COLS; c++) {
        ws.getCell(rowN, c).fill = solidFill("FFF9FAFB");
      }
      rowN++;
    }
    rowN++; // blank row

    // ── Sessions ──
    const sortedSessions = [...weekSessions].sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    );

    for (const session of sortedSessions) {
      const exes = exercisesBySession[session.id] ?? [];

      // ── DÍA row ──
      const dayLabel =
        fmtSessionDate(session.date) || session.day_name || `Sesión ${session.id}`;
      ws.getCell(rowN, 1).value =
        `DÍA   ·   ${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}`;
      applyStyle(ws.getCell(rowN, 1), {
        fill: solidFill(YEL),
        font: { bold: true, size: 11, color: { argb: BLK } },
        align: { horizontal: "left", vertical: "middle" },
        border: { bottom: { style: "medium", color: { argb: "FFD97706" } } },
      });
      ws.mergeCells(rowN, 1, rowN, TOTAL_COLS);
      ws.getRow(rowN).height = 20;
      rowN++;

      // ── Header row 1: section labels ──
      ws.getRow(rowN).height = 15;

      // Grupo, Ejercicio (non-merged)
      applyStyle(ws.getCell(rowN, 1), {
        fill: solidFill(BLK),
        font: { bold: true, size: 8, color: { argb: WHT } },
        align: { horizontal: "center", vertical: "middle" },
      });
      applyStyle(ws.getCell(rowN, 2), {
        fill: solidFill(BLK),
        font: { bold: true, size: 8, color: { argb: WHT } },
        align: { horizontal: "left", vertical: "middle" },
      });

      // COACH merged header
      ws.getCell(rowN, COACH_START).value = "COACH";
      applyStyle(ws.getCell(rowN, COACH_START), {
        fill: solidFill(BLK),
        font: { bold: true, size: 11, color: { argb: AMB } },
        align: { horizontal: "center", vertical: "middle" },
      });
      ws.mergeCells(rowN, COACH_START, rowN, COACH_END);

      // STUDENT merged header
      ws.getCell(rowN, STU_START).value = "STUDENT";
      applyStyle(ws.getCell(rowN, STU_START), {
        fill: solidFill(BLK),
        font: { bold: true, size: 11, color: { argb: STU_CLR } },
        align: { horizontal: "center", vertical: "middle" },
      });
      ws.mergeCells(rowN, STU_START, rowN, TOTAL_COLS);
      rowN++;

      // ── Header row 2: individual column names ──
      ws.getRow(rowN).height = 14;

      const hdrCoach = { fill: solidFill(BLK), font: { bold: true, size: 8, color: { argb: AMB } }, align: { horizontal: "center" as const, vertical: "middle" as const } };
      const hdrStu = { fill: solidFill(BLK), font: { bold: true, size: 8, color: { argb: STU_CLR } }, align: { horizontal: "center" as const, vertical: "middle" as const } };
      const hdrBase = { fill: solidFill(BLK), font: { bold: true, size: 8, color: { argb: WHT } }, align: { horizontal: "center" as const, vertical: "middle" as const } };

      applyStyle(ws.getCell(rowN, 1), hdrBase);
      ws.getCell(rowN, 2).value = "Ejercicio";
      applyStyle(ws.getCell(rowN, 2), { ...hdrBase, align: { horizontal: "left", vertical: "middle" } });

      let ci = COACH_START;
      ws.getCell(rowN, ci).value = "S"; applyStyle(ws.getCell(rowN, ci), hdrCoach); ci++;
      for (let i = 1; i <= maxSets; i++) { ws.getCell(rowN, ci).value = `R${i}`; applyStyle(ws.getCell(rowN, ci), hdrCoach); ci++; }
      for (let i = 1; i <= maxSets; i++) { ws.getCell(rowN, ci).value = `K${i}`; applyStyle(ws.getCell(rowN, ci), hdrCoach); ci++; }
      ws.getCell(rowN, ci).value = "RPE"; applyStyle(ws.getCell(rowN, ci), hdrCoach); ci++;
      ws.getCell(rowN, ci).value = "Pausa"; applyStyle(ws.getCell(rowN, ci), hdrCoach); ci++;
      ws.getCell(rowN, ci).value = "Obs"; applyStyle(ws.getCell(rowN, ci), { ...hdrCoach, align: { horizontal: "left", vertical: "middle" } }); ci++;

      ws.getCell(rowN, ci).value = "S"; applyStyle(ws.getCell(rowN, ci), hdrStu); ci++;
      for (let i = 1; i <= maxSets; i++) { ws.getCell(rowN, ci).value = `R${i}`; applyStyle(ws.getCell(rowN, ci), hdrStu); ci++; }
      for (let i = 1; i <= maxSets; i++) { ws.getCell(rowN, ci).value = `K${i}`; applyStyle(ws.getCell(rowN, ci), hdrStu); ci++; }
      ws.getCell(rowN, ci).value = "RPE"; applyStyle(ws.getCell(rowN, ci), hdrStu); ci++;
      ws.getCell(rowN, ci).value = "Obs"; applyStyle(ws.getCell(rowN, ci), { ...hdrStu, align: { horizontal: "left", vertical: "middle" } });
      rowN++;

      // ── Exercise rows ──
      const blocks = groupBlocks(exes);
      let alt = false;

      for (const block of blocks) {
        for (const ex of block.items) {
          const bg = alt ? ALT : WHT;
          const isTime = ex.exercise?.exercise_type === "TIME";
          ws.getRow(rowN).height = 17;

          let col = 1;

          // Grupo
          ws.getCell(rowN, col).value = block.letter ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(block.letter ? SST_BG : bg),
            font: { bold: true, size: 9, color: { argb: block.letter ? SST_TXT : "FFCCCCCC" } },
            align: { horizontal: "center", vertical: "middle" },
            border: {
              ...stdBorder(),
              right: block.letter
                ? { style: "medium", color: { argb: "FFD97706" } }
                : thinBorder(),
            },
          });
          col++;

          // Ejercicio
          ws.getCell(rowN, col).value = ex.exercise?.name ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(bg),
            font: { size: 10, color: { argb: BLK } },
            align: { horizontal: "left", vertical: "middle" },
            border: {
              ...stdBorder(),
              left: block.letter
                ? { style: "medium", color: { argb: "FFD97706" } }
                : thinBorder(),
            },
          });
          col++;

          // Coach S
          ws.getCell(rowN, col).value = ex.target_sets ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(bg),
            font: { bold: true, size: 10, color: { argb: "FF18181B" } },
            align: { horizontal: "center", vertical: "middle" },
            border: stdBorder(),
          });
          col++;

          // Coach R
          for (let i = 0; i < maxSets; i++) {
            const v = ex.target_reps?.[i];
            const has = v !== undefined && v !== null && v !== "";
            ws.getCell(rowN, col).value = has ? (isTime ? `${v}''` : v) : "";
            applyStyle(ws.getCell(rowN, col), {
              fill: solidFill(bg),
              font: { size: 9, color: { argb: "FF3F3F46" } },
              align: { horizontal: "center", vertical: "middle" },
              border: stdBorder(),
            });
            col++;
          }

          // Coach K
          for (let i = 0; i < maxSets; i++) {
            const v = ex.target_weight?.[i];
            const has = v !== undefined && v !== null && v !== "";
            ws.getCell(rowN, col).value = has ? v : "–";
            applyStyle(ws.getCell(rowN, col), {
              fill: solidFill(bg),
              font: { size: 9, color: { argb: "FF71717A" } },
              align: { horizontal: "center", vertical: "middle" },
              border: stdBorder(),
            });
            col++;
          }

          // Coach RPE
          const rpeC = rpeArgb(ex.target_rpe ?? null);
          ws.getCell(rowN, col).value = ex.target_rpe ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(rpeC ?? bg),
            font: { bold: !!rpeC, size: 10, color: { argb: BLK } },
            align: { horizontal: "center", vertical: "middle" },
            border: stdBorder(),
          });
          col++;

          // Pausa
          ws.getCell(rowN, col).value = ex.rest_seconds ? `${ex.rest_seconds}''` : "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(bg),
            font: { size: 9, color: { argb: "FF52525B" } },
            align: { horizontal: "center", vertical: "middle" },
            border: stdBorder(),
          });
          col++;

          // Coach Obs
          ws.getCell(rowN, col).value = ex.coach_notes ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(bg),
            font: { size: 8, color: { argb: "FF71717A" }, italic: true },
            align: { horizontal: "left", vertical: "middle", wrapText: false },
            border: stdBorder(),
          });
          col++;

          // Student S
          const hasStu = ex.actual_sets !== null && ex.actual_sets !== undefined;
          ws.getCell(rowN, col).value = ex.actual_sets ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(hasStu ? STU_FILL : STU_EMPTY),
            font: { bold: true, size: 10, color: { argb: STU_TXT } },
            align: { horizontal: "center", vertical: "middle" },
            border: stdBorder(),
          });
          col++;

          // Student R
          for (let i = 0; i < maxSets; i++) {
            const v = ex.actual_reps?.[i];
            const has = v !== undefined && v !== null && v !== "";
            ws.getCell(rowN, col).value = has ? (isTime ? `${v}''` : v) : "";
            applyStyle(ws.getCell(rowN, col), {
              fill: solidFill(has ? STU_FILL : STU_EMPTY),
              font: { size: 9, color: { argb: STU_TXT } },
              align: { horizontal: "center", vertical: "middle" },
              border: stdBorder(),
            });
            col++;
          }

          // Student K
          for (let i = 0; i < maxSets; i++) {
            const v = ex.actual_weight?.[i];
            const has = v !== undefined && v !== null && v !== "";
            ws.getCell(rowN, col).value = has ? v : "";
            applyStyle(ws.getCell(rowN, col), {
              fill: solidFill(has ? STU_FILL : STU_EMPTY),
              font: { size: 9, color: { argb: STU_TXT } },
              align: { horizontal: "center", vertical: "middle" },
              border: stdBorder(),
            });
            col++;
          }

          // Student RPE
          const rpeS = rpeArgb(ex.actual_rpe ?? null);
          ws.getCell(rowN, col).value = ex.actual_rpe ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(rpeS ?? STU_EMPTY),
            font: { bold: !!rpeS, size: 10, color: { argb: STU_TXT } },
            align: { horizontal: "center", vertical: "middle" },
            border: stdBorder(),
          });
          col++;

          // Student Obs
          const hasSN = !!ex.student_notes;
          ws.getCell(rowN, col).value = ex.student_notes ?? "";
          applyStyle(ws.getCell(rowN, col), {
            fill: solidFill(hasSN ? STU_FILL : STU_EMPTY),
            font: { size: 8, color: { argb: STU_TXT }, italic: true },
            align: { horizontal: "left", vertical: "middle" },
            border: stdBorder(),
          });

          alt = !alt;
          rowN++;
        }
      }

      // Separator between sessions
      ws.getRow(rowN).height = 6;
      for (let c = 1; c <= TOTAL_COLS; c++) {
        ws.getCell(rowN, c).fill = solidFill(GRY);
      }
      rowN++;
    }

    ws.views = [{ state: "frozen", xSplit: 0, ySplit: 4 }];
  }

  return workbook;
}
