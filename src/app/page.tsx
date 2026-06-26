"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ImageRecord {
  id: string;
  key: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
}

interface ReportRecord {
  id: string;
  key: string;
  filename: string;
  size: number;
  created_at: string;
  url: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/images");
      if (!res.ok) throw new Error("Failed to load images");
      setImages(await res.json());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) throw new Error("Failed to load reports");
      setReports(await res.json());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    loadReports();
  }, [load, loadReports]);

  const onGenerateReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/reports", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || "Report generation failed");
      }
      const report: ReportRecord = await res.json();
      await loadReports();
      // Open the freshly generated, storage-backed download link.
      window.open(report.url, "_blank");
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  };

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || "Upload failed");
      }
      if (fileInput.current) fileInput.current.value = "";
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Object Storage Service — POC</h1>
        <p className="text-sm text-gray-500">
          Upload images to MinIO, view &amp; download them, and export a report.
        </p>
      </header>

      <section className="mb-8 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <form onSubmit={onUpload} className="flex flex-wrap items-center gap-3">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            required
            className="text-sm"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
        <div className="ml-auto">
          <button
            type="button"
            onClick={onGenerateReport}
            disabled={generating}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate Excel Report"}
          </button>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Generated Reports ({reports.length})
        </h2>
        {reports.length === 0 ? (
          <p className="text-sm text-gray-500">
            No reports yet. Click “Generate Excel Report” to create one — it is
            stored in object storage and downloadable via a generated link.
          </p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {reports.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="font-medium">{r.filename}</span>
                <span className="text-xs text-gray-500">
                  {formatSize(r.size)} ·{" "}
                  {new Date(r.created_at).toLocaleString()}
                </span>
                <a
                  href={r.url}
                  className="ml-auto text-blue-600 hover:underline"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="mb-4 rounded bg-red-100 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Gallery ({images.length})
        </h2>
        {images.length === 0 ? (
          <p className="text-sm text-gray-500">
            No images yet. Upload one to get started.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {images.map((img) => (
              <li
                key={img.id}
                className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/images/${img.id}`}
                  alt={img.filename}
                  className="aspect-square w-full object-cover"
                />
                <div className="p-2">
                  <p
                    className="truncate text-xs font-medium"
                    title={img.filename}
                  >
                    {img.filename}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {formatSize(img.size)}
                  </p>
                  <a
                    href={`/api/images/${img.id}/download`}
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                  >
                    Download
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
