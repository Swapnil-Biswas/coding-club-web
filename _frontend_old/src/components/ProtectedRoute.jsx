import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

// Wrap a route element to require authentication. If not logged in, send to
// /login and remember where they were going so we can come back after login.
export function ProtectedRoute({ children, roles }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <div className="page-msg">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page-msg">
        <h2>403 — forbidden</h2>
        <p>You don't have access to this page.</p>
      </div>
    );
  }

  return children;
}
