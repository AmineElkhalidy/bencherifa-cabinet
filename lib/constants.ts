/**
 * Application-level "enums" mirroring the documented allowed values
 * stored as TEXT in SQLite. Treat these as the single source of truth —
 * Zod validators, UI selects, and DB writes all import from here.
 */

export const ROLES = ["RECEPTIONIST", "DOCTOR"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  RECEPTIONIST: "Réceptionniste",
  DOCTOR: "Docteur",
};

export const GENDERS = ["Male", "Female", "Child"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  Male: "Homme",
  Female: "Femme",
  Child: "Enfant",
};

export const INSURANCE_PROVIDERS = ["CNSS", "CNOPS", "MUTUELLE", "NONE"] as const;
export type InsuranceProvider = (typeof INSURANCE_PROVIDERS)[number];

export const INSURANCE_LABELS: Record<InsuranceProvider, string> = {
  CNSS: "CNSS",
  CNOPS: "CNOPS",
  MUTUELLE: "Mutuelle",
  NONE: "Aucune",
};

export const VISIT_TYPES = ["Consultation", "Control"] as const;
export type VisitType = (typeof VISIT_TYPES)[number];

export const VISIT_TYPE_LABELS: Record<VisitType, string> = {
  Consultation: "Consultation",
  Control: "Contrôle",
};

export const VISIT_STATUSES = ["Pending", "Completed"] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  Pending: "En attente",
  Completed: "Terminée",
};

export const DOCUMENT_TYPES = [
  "photo",
  "lab",
  "scan",
  "prescription",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  photo: "Photo",
  lab: "Résultat de labo",
  scan: "Imagerie",
  prescription: "Ordonnance",
  other: "Autre",
};

export const DEFAULT_VISIT_PRICE = 150;

export const EXPENSE_CATEGORIES = [
  "Medical Equipment",
  "Consumables",
  "Utilities",
  "Rent",
  "Other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  "Medical Equipment": "Équipement médical",
  Consumables: "Consommables",
  Utilities: "Services publics (Eau/Électricité)",
  Rent: "Loyer",
  Other: "Autre",
};

export const SESSION_COOKIE_NAME = "cabinet-session";
