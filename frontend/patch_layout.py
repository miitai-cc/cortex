import re

filepath = '/Volumes/workspace/ai/application/cortex/frontend/src/components/Layout.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
imports = """import TopNewsTicker from './common/TopNewsTicker';
import TopApiStatus from './common/TopApiStatus';
"""
# Insert after 'import TopQuickActions'
content = content.replace("import TopQuickActions from './TopQuickActions';", "import TopQuickActions from './TopQuickActions';\n" + imports)

# Find topToolArea
# <div className="topToolArea ...>
#   <CurrentWorkContext ... />
#   <div className="flex shrink-0 items-center gap-3">

old_block = """          <CurrentWorkContext
            context={systemContext.data?.data.currentUser}
            fallbackUsername={user?.username ?? 'unknown'}
            project={selectedProject.name || '未選專案'}
            directory={directory}
          />
          <div className="flex shrink-0 items-center gap-3">"""

new_block = """          <CurrentWorkContext
            context={systemContext.data?.data.currentUser}
            fallbackUsername={user?.username ?? 'unknown'}
            project={selectedProject.name || '未選專案'}
            directory={directory}
          />
          
          <div className="flex-1 flex justify-center px-4">
            <TopNewsTicker />
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <TopApiStatus systemContext={systemContext} />
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1"></div>"""

content = content.replace(old_block, new_block)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Patched Layout.tsx")
