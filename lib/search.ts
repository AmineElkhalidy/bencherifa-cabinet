type SearchValue = string | number | null | undefined;

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const SEPARATORS = /[^\p{Letter}\p{Number}]+/gu;

export function normalizeSearchText(value: SearchValue) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLocaleLowerCase()
    .replace(SEPARATORS, " ")
    .trim();
}

function compactSearchText(value: SearchValue) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

export function matchesSearchQuery(fields: SearchValue[], query: string) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const normalizedFields = fields.map(normalizeSearchText).filter(Boolean);
  const haystack = normalizedFields.join(" ");
  const compactHaystack = normalizedFields.map(compactSearchText).join(" ");
  const compactQuery = compactSearchText(query);

  return (
    tokens.every(
      (token) => haystack.includes(token) || compactHaystack.includes(token)
    ) || compactHaystack.includes(compactQuery)
  );
}
