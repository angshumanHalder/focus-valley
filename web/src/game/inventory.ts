export type ChartPeriod = "week" | "month" | "year";
const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
export const targetItemId = (target: FocusTarget) => target.kind === "crop" ? `crop:${target.cropId}` : `animal:${target.animalId}`;

export function chartRange(period: ChartPeriod, anchor: string, offset = 0) {
  const start = new Date(anchor + "T00:00:00Z");
  if (!["week", "month", "year"].includes(period) || !Number.isFinite(start.getTime()) || iso(start) !== anchor || !Number.isInteger(offset)) throw new RangeError("Choose a valid week, month or year.");
  if (period === "week") start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7 + offset * 7);
  else {
    start.setUTCDate(1);
    if (period === "month") start.setUTCMonth(start.getUTCMonth() + offset);
    else { start.setUTCMonth(0); start.setUTCFullYear(start.getUTCFullYear() + offset); }
  }
  const end = new Date(start);
  if (period === "week") end.setUTCDate(end.getUTCDate() + 7);
  else if (period === "month") end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { from: iso(start), to: iso(new Date(end.getTime() - dayMs)) };
}

export function inventoryStats(farm: FarmState, period: ChartPeriod, anchor: string, itemId?: string) {
  const { from, to } = chartRange(period, anchor);
  const labels = period === "week" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    : period === "month" ? ["1–7", "8–14", "15–21", `22–${Number(to.slice(8))}`]
    : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const values = labels.map(label => ({ label, minutes: 0 }));
  let completions = 0;
  // ponytail: scan guest memory; use server summaries when account sync is added.
  for (const session of farm.sessions) {
    if (itemId && targetItemId(session.target) !== itemId) continue;
    for (const [date, seconds] of Object.entries(session.focusSecondsByDate)) {
      if (date < from || date > to) continue;
      const index = period === "year" ? Number(date.slice(5, 7)) - 1
        : period === "month" ? Math.min(3, Math.floor((Number(date.slice(8)) - 1) / 7))
        : Math.round((Date.parse(date) - Date.parse(from)) / dayMs);
      values[index].minutes += seconds / 60;
    }
    if (session.completionDate >= from && session.completionDate <= to) completions++;
  }
  return { from, to, values, minutes: values.reduce((sum, bar) => sum + bar.minutes, 0), completions };
}
