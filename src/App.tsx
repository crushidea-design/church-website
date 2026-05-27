import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import QuotaExceededView from './components/QuotaExceededView';
import { SiteCmsProvider, useSiteCms } from './lib/siteCms';
import Layout from './components/Layout';
import Home from './pages/Home';

const Introduction = React.lazy(() => import('./pages/Introduction'));
const ArchiveLayout = React.lazy(() => import('./pages/ArchiveLayout'));
const TodayWord = React.lazy(() => import('./pages/TodayWord'));
const Sermons = React.lazy(() => import('./pages/Sermons'));
const ResearchLab = React.lazy(() => import('./pages/ResearchLab'));
const Community = React.lazy(() => import('./pages/Community'));
const PostDetail = React.lazy(() => import('./pages/PostDetail'));
const CreatePost = React.lazy(() => import('./pages/CreatePost'));
const EditPost = React.lazy(() => import('./pages/EditPost'));
const AdminUsers = React.lazy(() => import('./pages/AdminUsers'));
const AdminContacts = React.lazy(() => import('./pages/AdminContacts'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const AdminChurchInfo = React.lazy(() => import('./pages/AdminChurchInfo'));
const AdminNotifications = React.lazy(() => import('./pages/AdminNotifications'));
const AdminPastoralNotes = React.lazy(() => import('./pages/AdminPastoralNotes'));
const AdminNextGenerationCms = React.lazy(() => import('./pages/AdminNextGenerationCms'));
const AdminSiteCms = React.lazy(() => import('./pages/AdminSiteCms'));
const Journal = React.lazy(() => import('./pages/Journal'));
const Contact = React.lazy(() => import('./pages/Contact'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const PrayerRoom = React.lazy(() => import('./pages/PrayerRoom'));
const NextGeneration = React.lazy(() => import('./pages/NextGeneration'));
const WordFruitPrintView = React.lazy(() => import('./features/word-fruit/WordFruitPrintView'));
const WordFruitTreePreview = React.lazy(() => import('./features/word-fruit/WordFruitTreePreview'));
const Login = React.lazy(() => import('./pages/Login'));
const Profile = React.lazy(() => import('./pages/Profile'));

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-wood-50 px-4 text-sm font-medium text-wood-600">
      불러오는 중입니다.
    </div>
  );
}

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

function isRaahSubdomain() {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'raah.builttogether.church';
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
            <React.Suspense fallback={<RouteLoading />}>
              {isRaahSubdomain() ? (
                <Routes>
                  <Route path="*" element={<AdminPastoralNotes />} />
                </Routes>
              ) : (
                <Routes>
                  <Route path="/next/*" element={<NextGeneration />} />
                  <Route path="/next-generation/*" element={<RedirectNextGeneration />} />
                  <Route path="/print/word-fruit/:weekId" element={<WordFruitPrintView />} />
                  <Route path="/preview/word-fruit-tree" element={<WordFruitTreePreview />} />
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
              )}
            </React.Suspense>
          </BrowserRouter>
        </SiteCmsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
