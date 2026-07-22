import "server-only";

export type MedicationSuggestion = {
  name: string;
  activeIngredient: string;
  reimbursementRate: number | null;
};

type MedicationCatalogEntry = MedicationSuggestion & {
  nameSearch: string;
  ingredientSearch: string;
};

const MOROCCAN_MEDICATIONS_CSV_URL =
  "https://huggingface.co/datasets/ApyHTML19/Medicament_Marocain_2026/resolve/main/medicaments_marocain_2026.csv";

const collator = new Intl.Collator("fr", {
  numeric: true,
  sensitivity: "base",
});

const fallbackCatalog = toCatalogEntries([
  ["A-Gram", "Amoxicilline", 70],
  ["Acupan", "Nefopam", 0],
  ["Aerius", "Desloratadine", 0],
  ["Aerius Kids", "Desloratadine", 0],
  ["Augmentin", "Amoxicilline + Acide clavulanique", 70],
  ["Azro", "Azithromycine", 70],
  ["Bactimox", "Amoxicilline", 70],
  ["Bronchocalm", "Carbocisteine", 0],
  ["Clamoxyl", "Amoxicilline", 70],
  ["Clexane", "Enoxaparine", 70],
  ["Co-Diovan", "Valsartan + Hydrochlorothiazide", 70],
  ["Dafalgan", "Paracetamol", 70],
  ["Doliprane 1000 Mg", "Paracetamol", 70],
  ["Flagyl", "Metronidazole", 70],
  ["Gaviscon", "Alginates + bicarbonate de sodium", 0],
  ["Glucophage", "Metformine", 70],
  ["Klaricid", "Clarithromycine", 70],
  ["Levocetirizine Winthrop", "Levocetirizine", 0],
  ["Mopral", "Omeprazole", 70],
  ["Nexium", "Esomeprazole", 70],
  ["No-Spa", "Drotaverine", 0],
  ["Spasfon", "Phloroglucinol", 70],
  ["Tavanic", "Levofloxacine", 70],
  ["Ventoline", "Salbutamol", 70],
  ["Xyzall", "Levocetirizine", 0],
  ["Zinnat", "Cefuroxime", 70],
  ["Zithromax", "Azithromycine", 70],
  ["Zyrtec", "Cetirizine", 0],
]);

let catalogPromise: Promise<MedicationCatalogEntry[]> | null = null;

function normalizeMedicationText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function toCatalogEntries(
  rows: Array<[string, string, number | null]>
): MedicationCatalogEntry[] {
  return rows.map(([name, activeIngredient, reimbursementRate]) => ({
    name,
    activeIngredient,
    reimbursementRate,
    nameSearch: normalizeMedicationText(name),
    ingredientSearch: normalizeMedicationText(activeIngredient),
  }));
}

function buildCatalogFromCsv(csvText: string): MedicationCatalogEntry[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return fallbackCatalog;
  }

  const headers = parseCsvLine(lines[0]);
  const nameIndex = headers.indexOf("nom_medicament");
  const ingredientIndex = headers.indexOf("composant_dci");
  const reimbursementIndex = headers.indexOf("taux_remboursement_pct");

  if (nameIndex === -1 || ingredientIndex === -1) {
    return fallbackCatalog;
  }

  const uniqueEntries = new Map<string, [string, string, number | null]>();

  for (const line of lines.slice(1)) {
    const row = parseCsvLine(line);
    const name = row[nameIndex]?.trim();
    const activeIngredient = row[ingredientIndex]?.trim() ?? "";

    if (!name) continue;

    const reimbursementRate =
      reimbursementIndex >= 0
        ? Number.parseInt(row[reimbursementIndex] ?? "", 10)
        : Number.NaN;

    const key = `${normalizeMedicationText(name)}|${normalizeMedicationText(activeIngredient)}`;
    if (!uniqueEntries.has(key)) {
      uniqueEntries.set(key, [
        name,
        activeIngredient,
        Number.isFinite(reimbursementRate) ? reimbursementRate : null,
      ]);
    }
  }

  const catalog = toCatalogEntries([...uniqueEntries.values()]);
  return catalog.sort((a, b) => collator.compare(a.name, b.name));
}

async function loadMoroccanMedicationCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(MOROCCAN_MEDICATIONS_CSV_URL, {
      next: { revalidate: 60 * 60 * 24 },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch medication catalog: ${response.status}`);
        }

        const csvText = await response.text();
        return buildCatalogFromCsv(csvText);
      })
      .catch(() => fallbackCatalog);
  }

  return catalogPromise;
}

export async function searchMoroccanMedications(
  query: string,
  limit = 8
): Promise<MedicationSuggestion[]> {
  const normalizedQuery = normalizeMedicationText(query);
  if (normalizedQuery.length < 2) {
    return [];
  }

  const catalog = await loadMoroccanMedicationCatalog();
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  const ranked = catalog
    .map((item) => {
      const nameStarts = item.nameSearch.startsWith(normalizedQuery);
      const nameIncludes = item.nameSearch.includes(normalizedQuery);
      const ingredientStarts = item.ingredientSearch.startsWith(normalizedQuery);
      const ingredientIncludes = item.ingredientSearch.includes(normalizedQuery);
      const tokenMatch =
        tokens.length > 1 &&
        tokens.every(
          (token) =>
            item.nameSearch.includes(token) || item.ingredientSearch.includes(token)
        );

      let score = Number.POSITIVE_INFINITY;
      if (nameStarts) score = 0;
      else if (nameIncludes) score = 1;
      else if (ingredientStarts) score = 2;
      else if (ingredientIncludes) score = 3;
      else if (tokenMatch) score = 4;

      return { item, score };
    })
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return a.score - b.score;
      }
      return collator.compare(a.item.name, b.item.name);
    })
    .slice(0, limit)
    .map(({ item }) => ({
      name: item.name,
      activeIngredient: item.activeIngredient,
      reimbursementRate: item.reimbursementRate,
    }));

  return ranked;
}
