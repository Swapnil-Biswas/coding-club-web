"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/app/lib/api";
import { useAuth } from "@/app/lib/auth";
import { isCorePlus, isSuperCoreHead } from "@/app/lib/roles";
import type { Photo, ClubEvent } from "@/app/lib/types";
import { Spinner, EmptyState, PageHeader, Modal, Field, FormError, Badge, Tabs } from "@/app/components/app/ui";

export default function GalleryPage() {
  const { user, openAuth, ready } = useAuth();
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [filter, setFilter] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [error, setError] = useState("");

  const canUpload = !!user; // member and above can upload; backend re-checks
  const canModerateAny = user && isSuperCoreHead(user);

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
                canDelete={!!user && (p.uploaded_by === user.id || !!canModerateAny)}
                onOpen={() => setLightbox(p)}
                onChanged={load}
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
              <img src={lightbox.image_url} alt={lightbox.caption || "Gallery photo"} style={{ width: "100%", borderRadius: 12 }} />
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
  canDelete,
  onOpen,
  onChanged,
}: {
  photo: Photo;
  canDelete: boolean;
  onOpen: () => void;
  onChanged: () => void;
}) {
  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this photo?")) return;
    try {
      await api(`/photos/${photo.id}`, { method: "DELETE" });
      onChanged();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }

  return (
    <div className="gallery-item" onClick={onOpen} style={{ cursor: "pointer" }}>
      {photo.is_featured && (
        <div className="gallery-featured">
          <Badge variant="dark">★ Featured</Badge>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.image_url} alt={photo.caption || "Club photo"} loading="lazy" />
      <div className="gallery-item-cap">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
          <span>{photo.caption || "—"}</span>
          {canDelete && (
            <button
              onClick={remove}
              style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer" }}
            >
              Delete
            </button>
          )}
        </div>
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
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/photos", {
        method: "POST",
        body: { image_url: imageUrl.trim(), caption: caption.trim(), event_id: eventId ? Number(eventId) : undefined },
      });
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
    <Modal open={open} onClose={onClose} title="Upload a photo" eyebrow="// Share a moment" sub="Paste a link to an image. Keep them club-related.">
      <form onSubmit={submit}>
        <FormError>{error}</FormError>
        <Field label="Image URL" required hint="Direct link to the image (https://…)">
          <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" required />
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
        <button className="btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
    </Modal>
  );
}
