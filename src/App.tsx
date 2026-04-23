import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Home from './pages/Home';
import Introduction from './pages/Introduction';
import ArchiveLayout from './pages/ArchiveLayout';
import TodayWord from './pages/TodayWord';
import Sermons from './pages/Sermons';
import ResearchLab from './pages/ResearchLab';
import Community from './pages/Community';
import PostDetail from './pages/PostDetail';
import CreatePost from './pages/CreatePost';
import EditPost from './pages/EditPost';
import AdminUsers from './pages/AdminUsers';
import AdminContacts from './pages/AdminContacts';
import AdminDashboard from './pages/AdminDashboard';
import AdminChurchInfo from './pages/AdminChurchInfo';
import AdminNotifications from './pages/AdminNotifications';
import AdminPastoralNotes from './pages/AdminPastoralNotes';
import AdminNextGenerationCms from './pages/AdminNextGenerationCms';
import AdminSiteCms from './pages/AdminSiteCms';
import Journal from './pages/Journal';
import Contact from './pages/Contact';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PrayerRoom from './pages/PrayerRoom';
import NextGeneration from './pages/NextGeneration';

import Login from './pages/Login';
import Profile from './pages/Profile';
import QuotaExceededView from './components/QuotaExceededView';
import { SiteCmsProvider, useSiteCms } from './lib/siteCms';

function RedirectNextGeneration() {
  const location = useLocation();
  const nextPath = location.pathname.replace(/^\/next-generation/, '/next');

  return <Navigate to={`${nextPath}${location.search}${location.hash}`} replace />;
}

function CmsSlugRedirect() {
  const location = useLocation();
  const { pages } = useSiteCms();
  const slug = location.pathname.replace(/^\/+/, '');
  const matched = pages.find((page: any) => (page.routeSlug || page.slug) === slug);
  const allowedTargetPaths = new Set(['/', '/intro', '/archive', '/community']);

  if (!matched || !allowedTargetPaths.has(matched.targetPath)) {
    return <Navigate to="/" replace />;
  }

  return <Navigate to={matched.targetPath} replace />;
}

export default function App() {
  const [isQuotaExceeded, setIsQuotaExceeded] = React.useState(
    localStorage.getItem('firestore_quota_exceeded') === 'true'
  );

  React.useEffect(() => {
    // Check periodically or after a short delay to see if the connection test cleared the flag
    const checkQuota = () => {
      const currentStatus = localStorage.getItem('firestore_quota_exceeded') === 'true';
      if (currentStatus !== isQuotaExceeded) {
        setIsQuotaExceeded(currentStatus);
      }
    };

    const interval = setInterval(checkQuota, 1000);
    return () => clearInterval(interval);
  }, [isQuotaExceeded]);

  if (isQuotaExceeded) {
    return <QuotaExceededView />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SiteCmsProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/next/*" element={<NextGeneration />} />
              <Route path="/next-generation/*" element={<RedirectNextGeneration />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
                <Route path="profile" element={<Profile />} />
                <Route path="intro" element={<Introduction />} />
                <Route path="archive" element={<ArchiveLayout />}>
                  <Route index element={<Navigate to="today" replace />} />
                  <Route path="today" element={<TodayWord />} />
                  <Route path="sermons" element={<Sermons />} />
                  <Route path="research" element={<ResearchLab />} />
                </Route>
                <Route path="community" element={<Community />} />
                <Route path="prayer-room" element={<PrayerRoom />} />
                <Route path="post/:id" element={<PostDetail />} />
                <Route path="edit-post/:id" element={<EditPost />} />
                <Route path="create-post" element={<CreatePost />} />
                <Route path="admin/users" element={<AdminUsers />} />
                <Route path="admin/contacts" element={<AdminContacts />} />
                <Route path="admin/site-cms" element={<AdminSiteCms />} />
                <Route path="admin/sermon-categories" element={<Navigate to="/admin/site-cms" replace />} />
                <Route path="admin/research-categories" element={<Navigate to="/admin/site-cms" replace />} />
                <Route path="admin/church-info" element={<AdminChurchInfo />} />
                <Route path="admin/activity-logs" element={<Navigate to="/admin/site-cms" replace />} />
                <Route path="admin/notifications" element={<AdminNotifications />} />
                <Route path="admin/next-generation" element={<AdminNextGenerationCms />} />
                <Route path="raah" element={<AdminPastoralNotes />} />
                <Route path="admin" element={<AdminDashboard />} />
                <Route path="journal" element={<Journal />} />
                <Route path="contact" element={<Contact />} />
                <Route path="privacy" element={<PrivacyPolicy />} />
                <Route path=":cmsSlug" element={<CmsSlugRedirect />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SiteCmsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
