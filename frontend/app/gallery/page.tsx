"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, assetUrl } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { roleAtLeast } from "@/app/lib/roles";
import type { Photo, ClubEvent } from "@/app/lib/types";
import ImageSourceInput from "@/app/components/app/ImageSourceInput";
import { Spinner, EmptyState, PageHeader, Modal, Field, FormError, Badge, Tabs } from "@/app/components/app/ui";

export default function GalleryPage() {
  const { user, openAuth, ready } = useAuth();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [filter, setFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [error, setError] = useState("");

  const canUpload = !!user && roleAtLeast(user.role, "member");

  async function load() {
    try {
      const data = await api<{ photos: Photo[] }>("/gallery");
      setPhotos(data.photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    }
  }
  useEffect(() => {
    load();
    api<{ events: ClubEvent[] }>("/events").then((d) => setEvents(d.events)).catch(() => {});
  }, []);

  const filtered = photos?.filter((p) =>
    filter === "all" ? true : filter === "featured" ? p.is_featured : String(p.event_id) === filter,
  );

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "featured", label: "Featured" },
    ...events.map((e) => ({ id: String(e.id), label: e.title.length > 18 ? e.title.slice(0, 18) + "…" : e.title })),
  ];

  return (
    <div className="page">
      <div className="section-inner">
        <PageHeader
          eyebrow="// Gallery"
          title="Moments we"
          ghost="shipped."
          sub="Photos from hackathons, workshops, build nights, and the occasional 2am deploy."
          actions={
            canUpload ? (
              <button className="btn-primary" onClick={() => setUploadOpen(true)}>
                Upload photo
              </button>
            ) : ready ? (
              <button className="btn-secondary" onClick={() => openAuth("login")}>
                Sign in to upload
              </button>
            ) : undefined
          }
        />

        {photos && events.length > 0 && (
          <Tabs active={filter} onChange={setFilter} tabs={filterTabs} />
        )}

        {photos === null && !error && <Spinner label="Loading gallery" />}
        {error && <EmptyState title="Couldn't load the gallery" body={error} />}
        {photos && filtered && filtered.length === 0 && (
          <EmptyState title="No photos here yet" body="Be the first to share a moment from a club event." />
        )}

        {filtered && filtered.length > 0 && (
          <div className="gallery-grid">
            {filtered.map((p) => (
              <GalleryItem
                key={p.id}
                photo={p}
                onOpen={() => setLightbox(p)}
              />
            ))}
          </div>
        )}

        <UploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          events={events}
          onUploaded={() => {
            setUploadOpen(false);
            load();
          }}
        />

        <Modal open={!!lightbox} onClose={() => setLightbox(null)} large>
          {lightbox && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="gallery-lightbox-image" src={assetUrl(lightbox.image_url) || ""} alt={lightbox.caption || "Gallery photo"} />
              <p className="card-muted" style={{ marginTop: 14 }}>{lightbox.caption}</p>
              <p className="text-mono text-sm text-muted" style={{ marginTop: 6 }}>
                by {lightbox.uploader_name || "a member"}
              </p>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}

function GalleryItem({
  photo,
  onOpen,
}: {
  photo: Photo;
  onOpen: () => void;
}) {
  return (
    <div className="gallery-item" onClick={onOpen} style={{ cursor: "pointer" }}>
      {photo.is_featured && (
        <div className="gallery-featured">
          <Badge variant="dark">★ Featured</Badge>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={assetUrl(photo.image_url) || ""} alt={photo.caption || "Club photo"} loading="lazy" />
      <div className="gallery-item-cap">
        <span>{photo.caption || "—"}</span>
      </div>
    </div>
  );
}

function UploadModal({
  open,
  onClose,
  events,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  events: ClubEvent[];
  onUploaded: () => void;
}) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!imageFile && !imageUrl.trim()) {
      setError("Choose an image file or provide an image link.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      if (imageFile) {
        const body = new FormData();
        body.append("image", imageFile);
        body.append("caption", caption.trim());
        if (eventId) body.append("event_id", eventId);
        await api("/photos", { method: "POST", body, isForm: true });
      } else {
        await api("/photos", {
          method: "POST",
          body: { image_url: imageUrl.trim(), caption: caption.trim(), event_id: eventId ? Number(eventId) : undefined },
        });
      }
      setImageFile(null);
      setImageUrl("");
      setCaption("");
      setEventId("");
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Upload a photo" eyebrow="// Share a moment" sub="Choose an image or use a direct image link. Keep them club-related.">
      <form onSubmit={submit}>
        <FormError>{error}</FormError>
        <Field label="Image" required>
          <ImageSourceInput
            file={imageFile}
            url={imageUrl}
            onFileChange={setImageFile}
            onUrlChange={setImageUrl}
            onError={setError}
            disabled={busy}
          />
        </Field>
        <Field label="Caption">
          <input className="input" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What's happening here?" />
        </Field>
        <Field label="Event (optional)">
          <select className="select" value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">— Not tied to an event —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </Field>
        <button className="btn-primary btn-block" type="submit" disabled={busy || (!imageFile && !imageUrl.trim())}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
    </Modal>
  );
}
