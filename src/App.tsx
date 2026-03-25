import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import Layout from './components/Layout';
import Home from './pages/Home';
import Introduction from './pages/Introduction';
import Sermons from './pages/Sermons';
import ResearchLab from './pages/ResearchLab';
import Community from './pages/Community';
import PostDetail from './pages/PostDetail';
import CreatePost from './pages/CreatePost';
import EditPost from './pages/EditPost';
import Contact from './pages/Contact';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="intro" element={<Introduction />} />
              <Route path="sermons" element={<Sermons />} />
              <Route path="research" element={<ResearchLab />} />
              <Route path="community" element={<Community />} />
              <Route path="post/:id" element={<PostDetail />} />
              <Route path="edit-post/:id" element={<EditPost />} />
              <Route path="create-post" element={<CreatePost />} />
              <Route path="contact" element={<Contact />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
