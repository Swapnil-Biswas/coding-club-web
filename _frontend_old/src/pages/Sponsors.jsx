import { useState, useEffect } from 'react';
import { api } from '../api.js';

// Public Sponsors page
export function SponsorsPage() {
  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      const data = await api('/sponsors');
      setSponsors(data.sponsors || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page"><div className="loading">Loading sponsors…</div></div>;
  if (error) return <div className="page"><div className="error">{error}</div></div>;

  return (
    <div className="page">
      <h1>Our Sponsors</h1>
      <p className="hint">Thank you to our amazing sponsors for their support.</p>

      {sponsors.length === 0 ? (
        <div className="card info">No sponsors yet.</div>
      ) : (
        <div className="sponsors-grid">
          {sponsors.map((sponsor) => (
            <SponsorCard key={sponsor.id} sponsor={sponsor} />
          ))}
        </div>
      )}
    </div>
  );
}

function SponsorCard({ sponsor }) {
  return (
    <div className="sponsor-card card">
      <a href={sponsor.website || '#'} target="_blank" rel="noopener noreferrer" className="sponsor-link">
        <img src={sponsor.logo_url} alt={sponsor.name} className="sponsor-logo" />
        <h3>{sponsor.name}</h3>
        {sponsor.description && <p className="sponsor-desc">{sponsor.description}</p>}
        {sponsor.website && <span className="visit-link">Visit Website →</span>}
      </a>
    </div>
  );
}