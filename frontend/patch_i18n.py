import re
import os

replacements = {
    'PersonalFollowing.tsx': {
        'Tracked Documents': "{t('personal.following.title')}",
        'Your personalized collection of bookmarked knowledge and documents.': "{t('personal.following.desc')}",
        'No documents tracked': "{t('personal.following.empty.title')}",
        'Bookmark documents in the Knowledge Center to see them here.': "{t('personal.following.empty.desc')}"
    },
    'PersonalReview.tsx': {
        'Pending Reviews': "{t('personal.review.title')}",
        'Documents and records awaiting your approval.': "{t('personal.review.desc')}",
        'All caught up!': "{t('personal.review.empty.title')}",
        'You have no pending reviews at the moment.': "{t('personal.review.empty.desc')}",
        'Approve': "{t('personal.review.approve')}",
        'Reject': "{t('personal.review.reject')}",
        'Pending': "{t('personal.review.pending')}"
    },
    'PersonalPoints.tsx': {
        'Points': "{t('personal.points.title')}",
        'Your total contribution score.': "{t('personal.points.desc')}",
        'Points are automatically awarded when your knowledge submissions are approved or when you assist others.': "{t('personal.points.info')}",
        'Recent Activity': "{t('personal.points.recent')}",
        'No point activity yet.': "{t('personal.points.empty')}"
    },
    'PersonalProjects.tsx': {
        'My Projects': "{t('personal.projects.title')}",
        'Track your active projects and milestones.': "{t('personal.projects.desc')}",
        'View All Projects': "{t('personal.projects.viewAll')}",
        'No active projects': "{t('personal.projects.empty.title')}",
        'You are not currently assigned to any active projects.': "{t('personal.projects.empty.desc')}",
        'Manager:': "{t('personal.projects.manager')}",
        'Failed to load project data. Please verify the backend service.': "{t('personal.projects.error')}"
    },
    'PersonalTasks.tsx': {
        'My Tasks': "{t('personal.tasks.title')}",
        'Manage your personal to-dos and workflow tasks.': "{t('personal.tasks.desc')}",
        'New Task': "{t('personal.tasks.new')}",
        'Pending': "{t('personal.tasks.pending')}",
        'Completed': "{t('personal.tasks.completed')}",
        'Due:': "{t('personal.tasks.due')}",
        'No pending tasks!': "{t('personal.tasks.empty')}",
        '"Task Title:"': "t('personal.tasks.prompt')"
    },
    'PersonalAnnouncements.tsx': {
        'Announcements': "{t('personal.announcements.title')}",
        'Important news and personal alerts.': "{t('personal.announcements.desc')}",
        'You\'re all caught up!': "{t('personal.announcements.empty.title')}",
        'No new announcements at this time.': "{t('personal.announcements.empty.desc')}"
    },
    'PersonalStatus.tsx': {
        'Personal Status': "{t('personal.status.title')}",
        'Your daily punch records and attendance overview.': "{t('personal.status.desc')}",
        'Daily Punch': "{t('personal.status.punch')}",
        'Punch In': "{t('personal.status.punchIn')}",
        'Punch Out': "{t('personal.status.punchOut')}",
        'Attendance Overview': "{t('personal.status.overview')}",
        'Late (This Month)': "{t('personal.status.late')}",
        'Leave Hours': "{t('personal.status.leave')}",
        'Remaining PTO': "{t('personal.status.pto')}",
        'Days': "{t('personal.status.days')}"
    },
    'PersonalPhoneRecords.tsx': {
        'Phone Records': "{t('personal.phoneRecords.title')}",
        'Manage and track your incoming calls and notes.': "{t('personal.phoneRecords.desc')}",
        'Add Record': "{t('personal.phoneRecords.add')}",
        '"Search phone records..."': "t('personal.phoneRecords.search')",
        'Loading records...': "{t('personal.phoneRecords.loading')}",
        'No phone records found': "{t('personal.phoneRecords.empty')}"
    },
    'PersonalMemos.tsx': {
        'Memos & Notes': "{t('personal.memos.title')}",
        'Your personal sticky notes board.': "{t('personal.memos.desc')}",
        'New Memo': "{t('personal.memos.new')}",
        '"Search memos..."': "t('personal.memos.search')",
        'No memos found': "{t('personal.memos.empty')}"
    },
    'PersonalDirectory.tsx': {
        'Address Book': "{t('personal.directory.title')}",
        'Find and connect with colleagues across the company.': "{t('personal.directory.desc')}",
        '"Search by name, email, or title..."': "t('personal.directory.search')",
        'All Departments': "{t('personal.directory.allDepts')}",
        'No colleagues found matching your criteria': "{t('personal.directory.empty')}"
    },
    'PersonalSettings.tsx': {
        'Account Settings': "{t('personal.settings.title')}",
        'Manage your preferences, security, and notifications.': "{t('personal.settings.desc')}",
        'Profile & Preferences': "{t('personal.settings.profile')}",
        'Security & Login': "{t('personal.settings.security')}",
        'Notifications': "{t('personal.settings.notifications')}",
        'General Profile': "{t('personal.settings.general')}",
        'Display Name': "{t('personal.settings.displayName')}",
        'Email Address': "{t('personal.settings.email')}",
        'Language / Region': "{t('personal.settings.language')}",
        'Cancel': "{t('personal.settings.cancel')}",
        'Save Changes': "{t('personal.settings.save')}"
    }
}

base_dir = '/Volumes/workspace/ai/application/cortex/frontend/src/components/personal'

def process_file(filename, reps):
    filepath = os.path.join(base_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()

    # Add import useTranslation
    if 'useTranslation' not in content:
        content = "import { useTranslation } from 'react-i18next';\n" + content
    
    # Inject const { t } = useTranslation();
    # Find the function declaration
    func_match = re.search(r'export default function (\w+)\(\)\s*{', content)
    if func_match:
        func_name = func_match.group(1)
        if 'const { t } = useTranslation();' not in content:
            content = content.replace(f'export default function {func_name}() {{', f'export default function {func_name}() {{\n  const {{ t }} = useTranslation();')

    # Replace strings
    for old, new in reps.items():
        if old.startswith('"'):
            # It's an attribute string like placeholder="Search..."
            attr_old = f'placeholder={old}'
            attr_new = f'placeholder={{{new}}}'
            content = content.replace(attr_old, attr_new)
        else:
            # It's a text node or string
            content = content.replace(old, new)
            
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Updated {filename}")

for filename, reps in replacements.items():
    process_file(filename, reps)
