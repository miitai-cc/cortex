import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from 'eiva-fe-security';
import Layout from './components/Layout';
import { LoginPage } from 'eiva-fe-security';
import DashboardPage from './pages/DashboardPage';
import DashboardHealthPage from './pages/DashboardHealthPage';
import DashboardActivityPage from './pages/DashboardActivityPage';
import EnterpriseSystemsPage from './pages/EnterpriseSystemsPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentListPage from './pages/DocumentListPage';
import RecentDocumentsPage from './pages/RecentDocumentsPage';
import DepartmentFileManager from './components/documents/DepartmentFileManager';
import CommonFeaturesPage from './pages/CommonFeaturesPage';
import OrgManagementPage from './pages/OrgManagementPage';
import HrPortalPage from './pages/HrPortalPage';
import SearchPage from './pages/SearchPage';
import SearchHybridPage from './pages/SearchHybridPage';
import DocumentDetailPage from './pages/DocumentDetailPage';
import SettingsSystemPage from './pages/SettingsSystemPage';
import SystemAdministrationPage from './pages/SystemAdministrationPage';
import AiManagementSettingsPage from './pages/AiManagementSettingsPage';
import ChatPage from './pages/ChatPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import KnowledgeGraphPage from './pages/KnowledgeGraphPage';
import GraphCommunityPage from './pages/GraphCommunityPage';
import GraphIsolatedPage from './pages/GraphIsolatedPage';
import DeepResearchPage from './pages/DeepResearchPage';
import ResearchHistoryPage from './pages/ResearchHistoryPage';
import ResearchPanel from './pages/ResearchPanel';
import AiModelsPage from './pages/AiModelsPage';
import IndexingPage from './pages/IndexingPage';
import AiDocumentQueryPage from './pages/AiDocumentQueryPage';
import ContentManagementPage from './pages/ContentManagementPage';
import KnowledgeCenterPage from './pages/KnowledgeCenterPage';
import PersonalWorkspacePage from './pages/PersonalWorkspacePage';
import KnowledgeCategoriesPage from './pages/KnowledgeCategoriesPage';
import CollaborationPage from './pages/CollaborationPage';
import DepartmentPortalPage from './pages/DepartmentPortalPage';
import ProjectManagementPage from './pages/ProjectManagementPage';
import WorkflowManagementPage from './pages/WorkflowManagementPage';
import NotFoundPage from './pages/NotFoundPage';
import {
  clearRememberedReturnPath,
  DEFAULT_AUTHENTICATED_PATH,
  getRememberedReturnPath,
  hasValidAuthentication,
  LOGIN_PATH,
  rememberReturnPath,
  sanitizeReturnPath,
} from './utils/authNavigation';

type LoginLocationState = {
  from?: string;
};

const WorkflowDesignerPage = lazy(() => import('./pages/WorkflowDesignerPage'));
const ScreenDesignerPage = lazy(() => import('./pages/ScreenDesignerPage'));

function ProtectedLayout() {
  const { isAuthenticated, token } = useAuthStore();
  const location = useLocation();
  const returnPath = `${location.pathname}${location.search}`;
  const hasValidSession = hasValidAuthentication(isAuthenticated, token);

  useEffect(() => {
    if (!hasValidSession) rememberReturnPath(returnPath);
  }, [hasValidSession, returnPath]);

  if (!hasValidSession) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: returnPath }} />;
  }

  return <Layout />;
}

function LoginRoute() {
  const { isAuthenticated, token } = useAuthStore();
  const location = useLocation();
  const hasValidSession = hasValidAuthentication(isAuthenticated, token);
  const state = location.state as LoginLocationState | null;
  const returnPath =
    sanitizeReturnPath(state?.from) ??
    getRememberedReturnPath() ??
    DEFAULT_AUTHENTICATED_PATH;

  useEffect(() => {
    if (hasValidSession) clearRememberedReturnPath();
  }, [hasValidSession]);

  return hasValidSession ? <Navigate to={returnPath} replace /> : <LoginPage />;
}

function App() {
  const { isAuthenticated, token, logout } = useAuthStore();
  const hasValidSession = hasValidAuthentication(isAuthenticated, token);

  useEffect(() => {
    if (isAuthenticated && !hasValidSession) logout();
  }, [hasValidSession, isAuthenticated, logout]);

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={<Navigate to={hasValidSession ? DEFAULT_AUTHENTICATED_PATH : LOGIN_PATH} replace />}
        />
        <Route path={LOGIN_PATH} element={<LoginRoute />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/cortex" element={<Navigate to={DEFAULT_AUTHENTICATED_PATH} replace />} />
          <Route path={DEFAULT_AUTHENTICATED_PATH} element={<AiDocumentQueryPage />} />
          <Route path="/cortex/dashboard" element={<DashboardPage />} />
          <Route path="/cortex/dashboard/health" element={<DashboardHealthPage />} />
          <Route path="/cortex/dashboard/activity" element={<DashboardActivityPage />} />
          <Route path="/cortex/dashboard/enterprise-systems" element={<EnterpriseSystemsPage />} />
          <Route path="/cortex/departments/:department" element={<DepartmentPortalPage />} />
          <Route path="/cortex/documents" element={<DocumentsPage />} />
          <Route path="/cortex/projects/:section?" element={<ProjectManagementPage />} />
          <Route path="/cortex/workflows/designer" element={<Suspense fallback={<div className="card m-6 py-14 text-center text-gray-500">載入流程設計器…</div>}><WorkflowDesignerPage /></Suspense>} />
          <Route path="/cortex/workflows/screen-designer" element={<Suspense fallback={<div className="card m-6 py-14 text-center text-gray-500">載入畫面設計器…</div>}><ScreenDesignerPage /></Suspense>} />
          <Route path="/cortex/workflows/:section?" element={<WorkflowManagementPage />} />
          <Route path="/cortex/chat" element={<ChatPage />} />
          <Route path="/cortex/chat/directory" element={<CommonFeaturesPage />} />
          <Route path="/cortex/chat/leave" element={<CommonFeaturesPage />} />
          <Route path="/cortex/chat/overtime" element={<CommonFeaturesPage />} />
          <Route path="/cortex/chat/trip" element={<CommonFeaturesPage />} />
          <Route path="/cortex/chat/outing" element={<CommonFeaturesPage />} />
          <Route path="/cortex/chat/history" element={<ChatHistoryPage />} />
          <Route path="/cortex/collaboration/:section?" element={<CollaborationPage />} />
          <Route path="/cortex/documents" element={<DocumentsPage />} />
          <Route path="/cortex/documents/shared" element={<DepartmentFileManager />} />
          <Route path="/cortex/documents/forms" element={<DepartmentFileManager />} />
          <Route path="/cortex/documents/iso" element={<DepartmentFileManager />} />
          <Route path="/cortex/documents/list" element={<DocumentListPage />} />
          <Route path="/cortex/documents/recent" element={<RecentDocumentsPage />} />
          <Route path="/cortex/documents/indexing" element={<IndexingPage />} />
          <Route path="/cortex/documents/content" element={<ContentManagementPage />} />
          <Route path="/cortex/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/cortex/knowledge/:section?" element={<KnowledgeCenterPage />} />
          <Route path="/cortex/knowledge-categories" element={<KnowledgeCategoriesPage />} />
          <Route path="/cortex/workspace/:section?" element={<PersonalWorkspacePage />} />
          <Route path="/cortex/search" element={<SearchPage />} />
          <Route path="/cortex/search/hybrid" element={<SearchHybridPage />} />
          <Route path="/cortex/graph" element={<KnowledgeGraphPage />} />
          <Route path="/cortex/graph/community" element={<GraphCommunityPage />} />
          <Route path="/cortex/graph/isolated" element={<GraphIsolatedPage />} />
          <Route path="/cortex/orgManagement/:section?" element={<OrgManagementPage />} />
          <Route path="/cortex/hr/:section?" element={<HrPortalPage />} />
          <Route path="/cortex/research" element={<DeepResearchPage />} />
          <Route path="/cortex/graph/history" element={<ResearchHistoryPage />} />
          <Route path="/cortex/settings" element={<Navigate to="/cortex/settings/system" replace />} />
          <Route path="/cortex/settings/system" element={<SettingsSystemPage />} />
          <Route path="/cortex/settings/ai-management" element={<AiManagementSettingsPage />} />
          <Route path="/cortex/settings/:section" element={<SystemAdministrationPage />} />
          <Route path="/cortex/ai-models" element={<Navigate to="/cortex/ai-models/embedding" replace />} />
          <Route path="/cortex/ai-models/:tab" element={<AiModelsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      {hasValidSession && <ResearchPanel />}
    </>
  );
}

export default App;
