"use client";

import { useId, useRef, useState } from "react";

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface ImageSourceInputProps {
  file: File | null;
  url: string;
  onFileChange: (file: File | null) => void;
  onUrlChange: (url: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

export default function ImageSourceInput({
  file,
  url,
  onFileChange,
  onUrlChange,
  onError,
  disabled = false,
}: ImageSourceInputProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"file" | "url">(url && !file ? "url" : "file");

  function switchMode(next: "file" | "url") {
    setMode(next);
    onError?.("");
    if (next === "file") {
      onUrlChange("");
    } else {
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function selectFile(nextFile: File | null) {
    onError?.("");
    if (!nextFile) {
      onFileChange(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.has(nextFile.type)) {
      if (inputRef.current) inputRef.current.value = "";
      onFileChange(null);
      onError?.("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (nextFile.size > MAX_IMAGE_BYTES) {
      if (inputRef.current) inputRef.current.value = "";
      onFileChange(null);
      onError?.("Image must be 15 MiB or smaller.");
      return;
    }
    onUrlChange("");
    onFileChange(nextFile);
  }

  function clearFile() {
    if (inputRef.current) inputRef.current.value = "";
    onFileChange(null);
    onError?.("");
  }

  return (
    <div className="image-source-input">
      <div className="tabs image-source-tabs" role="tablist" aria-label="Image source">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "file"}
          className={`tab ${mode === "file" ? "is-active" : ""}`}
          onClick={() => switchMode("file")}
          disabled={disabled}
        >
          Choose file
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "url"}
          className={`tab ${mode === "url" ? "is-active" : ""}`}
          onClick={() => switchMode("url")}
          disabled={disabled}
        >
          Use image link
        </button>
      </div>

      {mode === "file" ? (
        <div className="image-file-control">
          <input
            ref={inputRef}
            id={inputId}
            className="image-file-native"
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
            disabled={disabled}
          />
          <label className="btn-secondary image-file-button" htmlFor={inputId}>
            Browse files
          </label>
          <span className="image-file-name">{file?.name || "No file selected"}</span>
          {file && (
            <button type="button" className="btn-secondary btn-sm" onClick={clearFile} disabled={disabled}>
              Clear
            </button>
          )}
        </div>
      ) : (
        <input
          className="input"
          type="url"
          inputMode="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://example.com/image.jpg"
          disabled={disabled}
        />
      )}
      <span className="field-hint">JPEG, PNG, or WebP. Maximum 15 MiB per image.</span>
    </div>
  );
}
