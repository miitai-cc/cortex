import os
import re

directories = {
    'dashboard': ['DashboardPage', 'DashboardActivityPage', 'DashboardHealthPage'],
    'workspace': ['PersonalWorkspacePage', 'CollaborationPage', 'DepartmentPortalPage', 'HrPortalPage', 'ProjectManagementPage'],
    'knowledge': ['KnowledgeCenterPage', 'KnowledgeCategoriesPage', 'KnowledgeGraphPage', 'DocumentsPage', 'DocumentListPage', 'DocumentDetailPage', 'RecentDocumentsPage', 'ContentManagementPage', 'GraphCommunityPage', 'GraphIsolatedPage'],
    'search': ['SearchPage', 'SearchHybridPage'],
    'ai': ['AiModelsPage', 'AiDocumentQueryPage', 'AiManagementSettingsPage', 'ChatPage', 'ChatHistoryPage', 'DeepResearchPage', 'ResearchHistoryPage', 'ResearchPanel'],
    'system': ['SettingsPage', 'SettingsSystemPage', 'SystemAdministrationPage', 'OrgManagementPage', 'EnterpriseSystemsPage', 'IndexingPage', 'ScreenDesignerPage', 'WorkflowDesignerPage', 'WorkflowManagementPage', 'CommonFeaturesPage']
}

page_to_dir = {}
for d, pages in directories.items():
    for p in pages:
        page_to_dir[p] = d

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    modified = False
    
    # We want to replace paths like:
    # import X from './pages/X';
    # import X from '../pages/X';
    # import { ... } from '../../pages/X';
    
    def replacer(match):
        nonlocal modified
        full_match = match.group(0)
        import_path = match.group(1) # e.g. ./pages/DashboardPage
        
        # extract the page name
        parts = import_path.split('/')
        page_name = parts[-1]
        
        if page_name in page_to_dir:
            # Check if it doesn't already have the category
            if len(parts) >= 2 and parts[-2] == page_to_dir[page_name]:
                return full_match
                
            new_path = "/".join(parts[:-1]) + "/" + page_to_dir[page_name] + "/" + page_name
            modified = True
            return full_match.replace(import_path, new_path)
            
        return full_match

    # Match imports from pages/ (e.g. from './pages/X' or from "../../pages/X")
    # Also match lazy(() => import('./pages/X'))
    new_content = re.sub(r'''from\s+['"]([^'"]*/pages/[^'"]+)['"]''', replacer, content)
    new_content = re.sub(r'''import\(['"]([^'"]*/pages/[^'"]+)['"]\)''', replacer, new_content)
    
    if modified:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('/Volumes/workspace/ai/application/cortex/frontend/src'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            process_file(os.path.join(root, file))
