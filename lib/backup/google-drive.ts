import "server-only";

import { createReadStream } from "node:fs";
import { google } from "googleapis";

import { logger } from "@/lib/logger";
import { BACKUP_MIMES, type BackupArtifact } from "./exporter";

export type DriveUploadResult = {
  uploaded: { id: string; name: string; webViewLink?: string }[];
  skipped: boolean;
  reason?: string;
  error?: string;
};

function getServiceAccountAuth() {
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!clientEmail || !privateKey || !folderId) {
    return { auth: null, folderId: null };
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  return { auth, folderId };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function uploadArtifactsToDrive(
  artifacts: BackupArtifact[],
  maxRetries = 3
): Promise<DriveUploadResult> {
  const { auth, folderId } = getServiceAccountAuth();
  if (!auth || !folderId) {
    return {
      uploaded: [],
      skipped: true,
      reason:
        "Google Drive is not configured (missing GOOGLE_DRIVE_* variables).",
    };
  }

  const drive = google.drive({ version: "v3", auth });
  const uploaded: DriveUploadResult["uploaded"] = [];

  for (const artifact of artifacts) {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxRetries) {
      attempt += 1;
      try {
        const res = await drive.files.create({
          requestBody: {
            name: artifact.filename,
            parents: [folderId],
            mimeType: BACKUP_MIMES[artifact.format],
          },
          media: {
            mimeType: BACKUP_MIMES[artifact.format],
            body: createReadStream(artifact.absolutePath),
          },
          fields: "id, name, webViewLink",
          supportsAllDrives: true,
        });

        if (res.data.id && res.data.name) {
          uploaded.push({
            id: res.data.id,
            name: res.data.name,
            webViewLink: res.data.webViewLink ?? undefined,
          });
        }
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        logger.warn("backup", "Google Drive upload attempt failed", {
          filename: artifact.filename,
          attempt,
          maxRetries,
          error: err instanceof Error ? err.message : String(err),
        });
        if (attempt < maxRetries) {
          await sleep(500 * Math.pow(2, attempt - 1));
        }
      }
    }

    if (lastError) {
      const errorMessage =
        lastError instanceof Error ? lastError.message : "Drive upload failed";
      logger.error("backup", "Google Drive upload exhausted retries", {
        filename: artifact.filename,
        error: errorMessage,
      });
      return {
        uploaded,
        skipped: false,
        error: `Google Drive upload failed for ${artifact.filename}: ${errorMessage}`,
      };
    }
  }

  return { uploaded, skipped: false };
}
