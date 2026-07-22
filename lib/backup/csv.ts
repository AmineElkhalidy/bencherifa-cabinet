export function toCsv(headers: string[], rows: Record<string, unknown>[]) {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const head = headers.join(",");
  const body = rows
    .map((r) => headers.map((h) => escape(r[h])).join(","))
    .join("\n");
  return `\uFEFF${head}\n${body}\n`;
}

export function iso(d: Date | null | undefined) {
  return d ? d.toISOString() : "";
}
