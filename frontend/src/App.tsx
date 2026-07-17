import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from 'eiva-fe-security';
import Layout from './components/Layout';
import { LoginPage } from 'eiva-fe-security';
import DashboardPage from './pages/DashboardPage';
import DashboardHealthPage from './pages/DashboardHealthPage';
import DashboardActivityPage from './pages/DashboardActivityPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentListPage from './pages/DocumentListPage';
import RecentDocumentsPage from './pages/RecentDocumentsPage';
import SearchPage from './pages/SearchPage';
import SearchHybridPage from './pages/SearchHybridPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import SettingsPage from './pages/SettingsPage';
import SettingsSystemPage from './pages/SettingsSystemPage';
import ChatPage from './pages/ChatPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import GraphCommunityPage from './pages/GraphCommunityPage';
import GraphIsolatedPage from './pages/GraphIsolatedPage';
import DeepResearchPage from './pages/DeepResearchPage';
import ResearchHistoryPage from './pages/ResearchHistoryPage';
import ResearchPanel from './pages/ResearchPanel';
import AiModelsPage from './pages/AiModelsPage';

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/cortex" replace />} />
        <Route path="/cortex/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/cortex" replace />} />
        <Route element={isAuthenticated ? <Layout /> : <Navigate to="/cortex/login" replace />}>
          <Route path="/cortex" element={<DashboardPage />} />
          <Route path="/cortex/dashboard/health" element={<DashboardHealthPage />} />
          <Route path="/cortex/dashboard/activity" element={<DashboardActivityPage />} />
          <Route path="/cortex/chat" element={<ChatPage />} />
          <Route path="/cortex/chat/history" element={<ChatHistoryPage />} />
          <Route path="/cortex/documents" element={<DocumentsPage />} />
          <Route path="/cortex/documents/list" element={<DocumentListPage />} />
          <Route path="/cortex/documents/recent" element={<RecentDocumentsPage />} />
          <Route path="/cortex/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/cortex/search" element={<SearchPage />} />
          <Route path="/cortex/search/hybrid" element={<SearchHybridPage />} />
          <Route path="/cortex/graph" element={<KnowledgeGraphPage />} />
          <Route path="/cortex/graph/community" element={<GraphCommunityPage />} />
          <Route path="/cortex/graph/isolated" element={<GraphIsolatedPage />} />
          <Route path="/cortex/research" element={<DeepResearchPage />} />
          <Route path="/cortex/research/history" element={<ResearchHistoryPage />} />
          <Route path="/cortex/settings" element={<SettingsPage />} />
          <Route path="/cortex/settings/system" element={<SettingsSystemPage />} />
          <Route path="/cortex/ai-models" element={<AiModelsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/cortex/login" replace />} />
      </Routes>
      {isAuthenticated && <ResearchPanel />}
    </>
  );
}

export default App;
