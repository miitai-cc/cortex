import os
import re

components = {
    'PersonalFollowing.tsx': {
        'icon': 'Bookmark',
        'title': "{t('personal.following.title')}",
        'desc': "{t('personal.following.desc')}",
        'theme': "titleColor: '#4f46e5'"
    },
    'PersonalReview.tsx': {
        'icon': 'ClipboardCheck',
        'title': "{t('personal.review.title')}",
        'desc': "{t('personal.review.desc')}",
        'theme': "titleColor: '#7c3aed'"
    },
    'PersonalPoints.tsx': {
        'icon': 'Trophy',
        'title': "{`${total} ${t('personal.points.title')}`}",
        'desc': "{t('personal.points.desc')}",
        'theme': "titleColor: '#f59e0b'"
    },
    'PersonalProjects.tsx': {
        'icon': 'LayoutDashboard',
        'title': "{t('personal.projects.title')}",
        'desc': "{t('personal.projects.desc')}",
        'theme': "titleColor: '#2563eb'",
        'extra_buttons': "{[{ label: t('personal.projects.viewAll'), icon: ArrowRight, onClick: () => navigate('/cortex/projects/information') }]}"
    },
    'PersonalTasks.tsx': {
        'icon': 'ClipboardList',
        'title': "{t('personal.tasks.title')}",
        'desc': "{t('personal.tasks.desc')}",
        'theme': "titleColor: '#4f46e5'",
        'extra_buttons': "{[{ label: t('personal.tasks.new'), icon: Plus, onClick: handleAdd }]}"
    },
    'PersonalAnnouncements.tsx': {
        'icon': 'Megaphone',
        'title': "{t('personal.announcements.title')}",
        'desc': "{t('personal.announcements.desc')}",
        'theme': "titleColor: '#db2777'"
    },
    'PersonalStatus.tsx': {
        'icon': 'User',
        'title': "{t('personal.status.title')}",
        'desc': "{t('personal.status.desc')}",
        'theme': "titleColor: '#059669'"
    },
    'PersonalPhoneRecords.tsx': {
        'icon': 'Phone',
        'title': "{t('personal.phoneRecords.title')}",
        'desc': "{t('personal.phoneRecords.desc')}",
        'theme': "titleColor: '#2563eb'",
        'extra_buttons': "{[{ label: t('personal.phoneRecords.add'), icon: Plus, onClick: handleAdd }]}"
    },
    'PersonalMemos.tsx': {
        'icon': 'StickyNote',
        'title': "{t('personal.memos.title')}",
        'desc': "{t('personal.memos.desc')}",
        'theme': "titleColor: '#eab308'",
        'extra_buttons': "{[{ label: t('personal.memos.new'), icon: Plus, onClick: handleAdd }]}"
    },
    'PersonalDirectory.tsx': {
        'icon': 'Users',
        'title': "{t('personal.directory.title')}",
        'desc': "{t('personal.directory.desc')}",
        'theme': "titleColor: '#ea580c'"
    },
    'PersonalSettings.tsx': {
        'icon': 'Settings',
        'title': "{t('personal.settings.title')}",
        'desc': "{t('personal.settings.desc')}",
        'theme': "titleColor: '#1e293b'"
    }
}

base_dir = '/Volumes/workspace/ai/application/cortex/frontend/src/components/personal'

for filename, props in components.items():
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()
        
    hero_str = f"""<CommonHeroTitle
        icon={{{props['icon']}}}
        title={props['title']}
        description={props['desc']}
        theme={{{{ {props['theme']} }}}}"""
        
    if 'extra_buttons' in props:
        hero_str += f"""
        extraButtons={props['extra_buttons']}"""
        
    hero_str += "\n      />"

    # Replace <CommonHeroTitle ... />
    new_content = re.sub(r'<CommonHeroTitle\s+icon=.*?\/>', hero_str, content, flags=re.DOTALL)
    
    with open(filepath, 'w') as f:
        f.write(new_content)
    print(f"Updated {filename}")
