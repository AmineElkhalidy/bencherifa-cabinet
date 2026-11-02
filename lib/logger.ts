import "server-only";

export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  meta?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "token",
  "secret",
  "privateKey",
  "cin",
  "phoneNumber",
  "diagnosis",
  "prescribedTreatment",
  "clinicalNotes",
  "hps",
  "rs",
  "pe",
  "vitals",
  "eco",
  "bloodWork",
  "allergies",
  "surgicalHistory",
  "contraindications",
]);

function sanitizeMeta(
  meta?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(k)) {
      clean[k] = "[REDACTED]";
    } else if (v instanceof Error) {
      clean[k] = { name: v.name, message: v.message };
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function writeLog(
  level: LogLevel,
  category: string,
  message: string,
  meta?: Record<string, unknown>
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...(meta ? { meta: sanitizeMeta(meta) } : {}),
  };

  const formatted =
    process.env.NODE_ENV === "production"
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] [${level.toUpperCase()}] [${category}] ${message}${
          entry.meta ? " " + JSON.stringify(entry.meta) : ""
        }`;

  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  info(category: string, message: string, meta?: Record<string, unknown>) {
    writeLog("info", category, message, meta);
  },
  warn(category: string, message: string, meta?: Record<string, unknown>) {
    writeLog("warn", category, message, meta);
  },
  error(category: string, message: string, meta?: Record<string, unknown>) {
    writeLog("error", category, message, meta);
  },
};

