type RentOutcome = "open" | "paid" | "waived" | "closed";

export interface RentPeriod {
  month: number;
  firstDay: number;
  lastDay: number;
  cups: number;
  takings: number;
  payroll: number;
  expired: number;
  rent: number;
  reserve: number;
  outcome: RentOutcome;
}

export interface RentBook {
  current: RentPeriod | null;
  history: RentPeriod[];
}

type RentDayFacts = Pick<RentPeriod, "cups" | "takings" | "payroll" | "expired" | "rent" | "reserve" | "outcome"> & {
  day: number;
};

const HISTORY_LIMIT = 12;
const MAX_TOTAL = Number.MAX_SAFE_INTEGER;

function whole(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(MAX_TOTAL, Math.max(0, Math.floor(value))) : 0;
}

function positiveDay(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isOutcome(value: unknown): value is RentOutcome {
  return value === "open" || value === "paid" || value === "waived" || value === "closed";
}

function totals(source: Partial<RentDayFacts>) {
  return {
    cups: whole(source.cups), takings: whole(source.takings), payroll: whole(source.payroll),
    expired: whole(source.expired), rent: whole(source.rent), reserve: whole(source.reserve),
  };
}

function normalizePeriod(value: unknown): RentPeriod | null {
  if (!value || typeof value !== "object") return null;
  const period = value as Partial<RentPeriod>;
  const { month, firstDay, lastDay, outcome } = period;
  if (!positiveDay(month) || !positiveDay(firstDay) || !positiveDay(lastDay) ||
      firstDay > lastDay || !isOutcome(outcome)) return null;
  return { month, firstDay, lastDay, ...totals(period), outcome };
}

export function normalizeRentBook(value: unknown): RentBook {
  if (!value || typeof value !== "object") return { current: null, history: [] };
  const saved = value as Partial<RentBook>;
  const byMonth = new Map<number, RentPeriod>();
  if (Array.isArray(saved.history)) {
    for (const item of saved.history) {
      const entry = normalizePeriod(item);
      if (!entry || entry.outcome === "open") continue;
      if ((byMonth.get(entry.month)?.lastDay ?? 0) <= entry.lastDay) byMonth.set(entry.month, entry);
    }
  }
  const history = [...byMonth.values()].sort((a, b) => a.month - b.month).slice(-HISTORY_LIMIT);
  const current = normalizePeriod(saved.current);
  const latest = history.at(-1);
  return {
    current: current?.outcome === "open" && (!latest || (current.month > latest.month && current.firstDay > latest.lastDay))
      ? current : null,
    history,
  };
}

export function recordRentDay(book: RentBook, facts: RentDayFacts, cycleDays = 7): RentBook {
  const { current, history } = normalizeRentBook(book);
  const { day } = facts;
  const latest = history.at(-1);
  if (!positiveDay(day) || !isOutcome(facts.outcome) || day <= Math.max(current?.lastDay ?? 0, latest?.lastDay ?? 0)) {
    return { current, history };
  }

  const month = Math.ceil(day / (positiveDay(cycleDays) ? cycleDays : 7));
  if (latest && month <= latest.month) return { current, history };
  const previous = current?.month === month ? current : null;
  const dayTotals = totals(facts);
  const period: RentPeriod = {
    month,
    firstDay: previous?.firstDay ?? day,
    lastDay: day,
    cups: whole((previous?.cups ?? 0) + dayTotals.cups),
    takings: whole((previous?.takings ?? 0) + dayTotals.takings),
    payroll: whole((previous?.payroll ?? 0) + dayTotals.payroll),
    expired: whole((previous?.expired ?? 0) + dayTotals.expired),
    rent: whole((previous?.rent ?? 0) + dayTotals.rent),
    reserve: dayTotals.reserve,
    outcome: facts.outcome,
  };

  if (period.outcome === "open") return { current: period, history };
  return { current: null, history: [...history, period].slice(-HISTORY_LIMIT) };
}
