import { useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';

// Members panel. The route itself is gated server-side — non-core/admin
// can't even GET /users. We render only the action buttons the current
// user's role is allowed to use, but the server is the source of truth.
export function Members() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/users');
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (targetId, newRole) => {
    setBusyId(targetId);
    setError(null);
    try {
      await api(`/users/${targetId}/role`, { method: 'PATCH', body: { role: newRole } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  return (
    <div className="page">
      <h1>Members</h1>
      <p className="muted">
        You see this page because your role is <strong>{user.role}</strong>.
      </p>
      {error && <div className="error">{error}</div>}
      <table className="users-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Verified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td><span className="role-badge">{u.role}</span></td>
              <td>{u.email_verified ? 'yes' : 'no'}</td>
              <td className="actions">
                {user.role === 'core' && u.role === 'public' && u.email_verified && (
                  <button
                    disabled={busyId === u.id}
                    onClick={() => changeRole(u.id, 'member')}
                  >
                    Promote to Member
                  </button>
                )}
                {user.role === 'admin' && u.role === 'member' && (
                  <button
                    disabled={busyId === u.id}
                    onClick={() => changeRole(u.id, 'core')}
                  >
                    Promote to Core
                  </button>
                )}
                {user.role === 'admin' && u.role === 'core' && u.id !== user.id && (
                  <button
                    disabled={busyId === u.id}
                    onClick={() => changeRole(u.id, 'member')}
                  >
                    Demote to Member
                  </button>
                )}
                {u.id === user.id && u.role === 'admin' && (
                  <span className="muted">(you)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
