import { useState, useEffect } from 'react';
import { api } from '../api.js';

// Public Gallery page - shows all photos in a grid
export function GalleryPage() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 24;

  useEffect(() => {
    loadPhotos();
  }, [page]);

  const loadPhotos = async () => {
    try {
      const data = await api(`/gallery?limit=${PAGE_SIZE}&offset=${(page - 1) * PAGE_SIZE}`);
      if (data.photos.length < PAGE_SIZE) setHasMore(false);
      setPhotos((prev) => (page === 1 ? data.photos : [...prev, ...data.photos]));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && photos.length === 0) return <div className="page"><div className="loading">Loading gallery…</div></div>;
  if (error) return <div className="page"><div className="error">{error}</div></div>;

  return (
    <div className="page">
      <h1>Photo Gallery</h1>

      {photos.length === 0 ? (
        <div className="card info">No photos in the gallery yet.</div>
      ) : (
        <>
          <div className="gallery-grid">
            {photos.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} onClick={() => setSelectedPhoto(photo)} />
            ))}
          </div>

          {hasMore && (
            <div className="load-more-wrapper">
              <button className="btn-secondary" onClick={() => setPage((p) => p + 1)}>
                Load More
              </button>
            </div>
          )}
        </>
      )}

      {selectedPhoto && (
        <PhotoModal photo={selectedPhoto} onClose={() => setSelectedPhoto(null)} />
      )}
    </div>
  );
}

function PhotoCard({ photo, onClick }) {
  return (
    <div className="photo-card" onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <img src={photo.image_url} alt={photo.caption || 'Gallery photo'} loading="lazy" />
      {photo.caption && <div className="photo-caption">{photo.caption}</div>}
      {photo.is_featured && <span className="featured-badge">Featured</span>}
    </div>
  );
}

function PhotoModal({ photo, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <img src={photo.image_url} alt={photo.caption || 'Gallery photo'} />
        {photo.caption && <p className="modal-caption">{photo.caption}</p>}
        {photo.uploader_name && <p className="modal-uploader">Uploaded by: {photo.uploader_name}</p>}
      </div>
    </div>
  );
}