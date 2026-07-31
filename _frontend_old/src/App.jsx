import { Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { Home } from './pages/Home.jsx';
import { Signup } from './pages/Signup.jsx';
import { Verify } from './pages/Verify.jsx';
import { Login } from './pages/Login.jsx';
import { Account } from './pages/Account.jsx';
import { Members } from './pages/Members.jsx';
import { EventList } from './pages/EventList.jsx';
import { EventDetail } from './pages/EventDetail.jsx';
import { EventEditor } from './pages/EventEditor.jsx';
import { EventDashboard } from './pages/EventDashboard.jsx';
import { CheckIn } from './pages/CheckIn.jsx';
import { RegistrantImport } from './pages/RegistrantImport.jsx';
import { AboutPage } from './pages/About.jsx';
import { TeamsPage } from './pages/Teams.jsx';
import { GalleryPage } from './pages/Gallery.jsx';
import { SponsorsPage } from './pages/Sponsors.jsx';
import { JoinUsPage } from './pages/JoinUs.jsx';
import { TeamDashboard } from './pages/TeamDashboard.jsx';
import { PublicProfile } from './pages/PublicProfile.jsx';

const MANAGERS = ['core', 'core_head', 'admin'];
const CORE_PLUS = ['core', 'core_head', 'admin'];
const CORE_HEAD_PLUS = ['core_head', 'admin'];

export default function App() {
  return (
    <div className="app">
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/login" element={<Login />} />

          {/* Public pages */}
          <Route path="/about" element={<AboutPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/sponsors" element={<SponsorsPage />} />
          <Route path="/join" element={<JoinUsPage />} />
          <Route path="/profile/:id" element={<PublicProfile />} />

          <Route path="/events" element={<EventList />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/members"
            element={
              <ProtectedRoute roles={CORE_PLUS}>
                <Members />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/new"
            element={
              <ProtectedRoute roles={MANAGERS}>
                <EventEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id/edit"
            element={
              <ProtectedRoute roles={MANAGERS}>
                <EventEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage/events"
            element={
              <ProtectedRoute roles={MANAGERS}>
                <EventDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkin"
            element={
              <ProtectedRoute roles={CORE_PLUS}>
                <CheckIn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/events/:id/registrants"
            element={
              <ProtectedRoute roles={CORE_HEAD_PLUS}>
                <RegistrantImport />
              </ProtectedRoute>
            }
          />

          {/* Team Dashboard - core_head, President (club_title), admin */}
          <Route
            path="/dashboard/teams"
            element={
              <ProtectedRoute roles={CORE_HEAD_PLUS}>
                <TeamDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
