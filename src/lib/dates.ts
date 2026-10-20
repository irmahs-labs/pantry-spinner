const DAY_MS = 86_400_000;

const toISO = (date: Date): string => {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
};

export const todayISO = (): string => toISO(new Date());

/** Today's weekday in full, as the draw screen's heading shows it. */
export const todayWeekday = (): string =>
  new Date().toLocaleDateString("en-GB", { weekday: "long" });

export const addDaysISO = (days: number, from: Date = new Date()): string => {
  const date = new Date(from);
  date.setDate(date.getDate() + days);

  return toISO(date);
};

/** Whole days from today to that date: 0 is today, negative is overdue. */
export const daysUntil = (iso: string): number => {
  const target = new Date(`${iso}T00:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  return Math.round((target.getTime() - start.getTime()) / DAY_MS);
};

export const dayLabel = (iso: string): string =>
  iso === todayISO()
    ? "Tonight"
    : new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
      });
