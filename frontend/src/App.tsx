import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from 'eiva-fe-security';
import Layout from './components/Layout';
import { LoginPage } from 'eiva-fe-security';
import DashboardPage from './pages/DashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import SearchPage from './pages/SearchPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import SettingsPage from './pages/SettingsPage';
import ChatPage from './pages/ChatPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import DeepResearchPage from './pages/DeepResearchPage';
import ResearchPanel from './pages/ResearchPanel';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
        <Route element={isAuthenticated ? <Layout /> : <Navigate to="/login" />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/graph" element={<KnowledgeGraphPage />} />
          <Route path="/research" element={<DeepResearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      {isAuthenticated && <ResearchPanel />}
    </>
  );
}

export default App;
