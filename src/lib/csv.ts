// Minimal, correct CSV serialization (RFC 4180). Pure + testable.

export type CsvValue = string | number | null | undefined;

/** Escape one field: quote it when it contains a comma, quote, or newline. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/** Build a CSV string with a header row from typed columns. */
export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(","));
  return [head, ...body].join("\r\n");
}
