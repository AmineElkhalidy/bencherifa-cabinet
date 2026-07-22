"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileImage,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/constants";
import { formatRelative } from "@/lib/date";

type Doc = {
  id: string;
  fileUrl: string;
  documentType: string;
  createdAt: string;
};

export function DocumentUploader({
  consultationId,
  initialDocuments,
}: {
  consultationId: string | null;
  initialDocuments: Doc[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType>("photo");
  const [isUploading, startUpload] = useTransition();
  const [docs, setDocs] = useState<Doc[]>(initialDocuments);

  function trigger() {
    if (!consultationId) {
      toast.info(
        "Switch to another tab first to save your notes, then you can add documents."
      );
      return;
    }
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !consultationId) return;

    startUpload(async () => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("consultationId", consultationId);
      formData.append("documentType", type);

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const created = (await res.json()) as Doc;
        setDocs((prev) => [created, ...prev]);
        toast.success("Document added");
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Upload failed");
      }
    });
  }

  function handleDelete(id: string) {
    startUpload(async () => {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
        toast.success("Document deleted");
        router.refresh();
      } else {
        toast.error("Unable to delete document");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 rounded-xl border border-dashed border-border bg-card/40 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="document-type">Document type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as DocumentType)}
          >
            <SelectTrigger id="document-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={trigger}
          disabled={isUploading || !consultationId}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload file
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={handleFileChange}
        />
      </div>

      {!consultationId ? (
        <EmptyState
          icon={FileImage}
          title="Consultation not saved yet"
          description="Save the consultation once before attaching photos, prescriptions, or lab results."
        />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="No documents"
          description="Clinical photos, scanned prescriptions, and results will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => {
            const isImage = /\.(png|jpe?g|gif|webp)$/i.test(d.fileUrl);
            return (
              <li
                key={d.id}
                className="group overflow-hidden rounded-lg border border-border bg-card"
              >
                <a
                  href={`/api/documents/${d.id}/file`}
                  target="_blank"
                  rel="noreferrer"
                  className="block"
                >
                  {isImage ? (
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      <img
                        src={`/api/documents/${d.id}/file`}
                        alt={d.documentType}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
                      <FileText className="h-10 w-10" />
                    </div>
                  )}
                </a>
                <div className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize">
                      {DOCUMENT_TYPE_LABELS[
                        d.documentType as DocumentType
                      ] ?? d.documentType}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatRelative(d.createdAt)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(d.id)}
                    className="text-destructive hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
