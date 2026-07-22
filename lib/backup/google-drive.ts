import "server-only";

import { createReadStream } from "node:fs";
import { google } from "googleapis";

import { BACKUP_MIMES, type BackupArtifact } from "./exporter";

export type DriveUploadResult = {
  uploaded: { id: string; name: string; webViewLink?: string }[];
  skipped: boolean;
  reason?: string;
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

export async function uploadArtifactsToDrive(
  artifacts: BackupArtifact[]
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
  }

  return { uploaded, skipped: false };
}
