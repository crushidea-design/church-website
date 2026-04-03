import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import AdminSermonCategories from './pages/AdminSermonCategories';
import AdminResearchCategories from './pages/AdminResearchCategories';
import AdminChurchInfo from './pages/AdminChurchInfo';
import AdminActivityLogs from './pages/AdminActivityLogs';
import AdminNotifications from './pages/AdminNotifications';
import Journal from './pages/Journal';
import Contact from './pages/Contact';
import PrivacyPolicy from './pages/PrivacyPolicy';
import PrayerRoom from './pages/PrayerRoom';

import Login from './pages/Login';
import Profile from './pages/Profile';
import QuotaExceededView from './components/QuotaExceededView';

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
        <BrowserRouter>
          <Routes>
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
              <Route path="admin/sermon-categories" element={<AdminSermonCategories />} />
              <Route path="admin/research-categories" element={<AdminResearchCategories />} />
              <Route path="admin/church-info" element={<AdminChurchInfo />} />
              <Route path="admin/activity-logs" element={<AdminActivityLogs />} />
              <Route path="admin/notifications" element={<AdminNotifications />} />
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="journal" element={<Journal />} />
              <Route path="contact" element={<Contact />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
