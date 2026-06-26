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

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function Home() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [uploading, setUploading] = useState(false);
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

  useEffect(() => {
    load();
  }, [load]);

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
        throw new Error(body.error || "Upload failed");
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
          <a
            href="/api/report"
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Download Excel Report
          </a>
        </div>
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
