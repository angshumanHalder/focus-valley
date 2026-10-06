export function dateInZone(ms: number, formatter: Intl.DateTimeFormat): string {
  const parts = Object.fromEntries(
    formatter.formatToParts(ms).map((part) => [part.type, part.value]),
  );
  return `${parts.year.padStart(4, "0")}-${parts.month}-${parts.day}`;
}

export function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
