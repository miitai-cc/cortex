import json
import os

new_keys_zh = {
  "personal.following.title": "追蹤文件",
  "personal.following.desc": "您個人專屬的書籤與文件收藏。",
  "personal.following.empty.title": "目前沒有追蹤的文件",
  "personal.following.empty.desc": "在知識中心將文件加入書籤，它們將會顯示在這裡。",
  
  "personal.review.title": "待處理審核",
  "personal.review.desc": "等待您簽核與審批的文件與紀錄。",
  "personal.review.empty.title": "全部處理完畢！",
  "personal.review.empty.desc": "目前沒有任何待審核的項目。",
  "personal.review.approve": "通過",
  "personal.review.reject": "退回",
  "personal.review.pending": "待處理",
  
  "personal.points.title": "個人積分",
  "personal.points.desc": "您的總貢獻積分。",
  "personal.points.info": "當您的知識貢獻被批准或協助他人時，系統會自動給予積分。",
  "personal.points.recent": "近期活動",
  "personal.points.empty": "尚無積分異動紀錄。",
  
  "personal.projects.title": "我的專案",
  "personal.projects.desc": "追蹤您參與的專案與里程碑。",
  "personal.projects.viewAll": "查看所有專案",
  "personal.projects.empty.title": "沒有進行中的專案",
  "personal.projects.empty.desc": "您目前並未參與任何進行中的專案。",
  "personal.projects.manager": "專案經理：",
  "personal.projects.error": "無法載入專案資料，請確認後端服務狀態。",
  
  "personal.tasks.title": "待辦事項",
  "personal.tasks.desc": "管理您的個人待辦清單與工作流程。",
  "personal.tasks.new": "新增待辦",
  "personal.tasks.pending": "處理中",
  "personal.tasks.completed": "已完成",
  "personal.tasks.due": "到期：",
  "personal.tasks.empty": "沒有待辦事項！",
  "personal.tasks.prompt": "待辦事項標題：",
  
  "personal.announcements.title": "公告與快訊",
  "personal.announcements.desc": "重要新聞與個人通知。",
  "personal.announcements.empty.title": "您已閱讀所有通知！",
  "personal.announcements.empty.desc": "目前沒有新的公告訊息。",
  
  "personal.status.title": "個人狀態",
  "personal.status.desc": "您的每日打卡紀錄與出缺勤概況。",
  "personal.status.punch": "每日打卡",
  "personal.status.punchIn": "上班打卡",
  "personal.status.punchOut": "下班打卡",
  "personal.status.overview": "出缺勤概況",
  "personal.status.late": "本月遲到",
  "personal.status.leave": "請假時數",
  "personal.status.pto": "特休餘額",
  "personal.status.days": "天",
  
  "personal.phoneRecords.title": "電話紀錄",
  "personal.phoneRecords.desc": "管理並追蹤您的來電與留言。",
  "personal.phoneRecords.add": "新增紀錄",
  "personal.phoneRecords.search": "搜尋電話紀錄...",
  "personal.phoneRecords.loading": "正在載入紀錄...",
  "personal.phoneRecords.empty": "找不到符合的電話紀錄",
  
  "personal.memos.title": "備忘錄",
  "personal.memos.desc": "您的個人便利貼留言板。",
  "personal.memos.new": "新增備忘",
  "personal.memos.search": "搜尋備忘錄...",
  "personal.memos.empty": "找不到符合的備忘錄",
  
  "personal.directory.title": "通訊錄",
  "personal.directory.desc": "尋找並聯絡公司內的其他同仁。",
  "personal.directory.search": "透過姓名、Email 或職稱搜尋...",
  "personal.directory.allDepts": "所有部門",
  "personal.directory.empty": "找不到符合條件的同仁",
  
  "personal.settings.title": "帳號設定",
  "personal.settings.desc": "管理您的個人偏好、安全性與通知設定。",
  "personal.settings.profile": "個人檔案與偏好",
  "personal.settings.security": "安全性與登入",
  "personal.settings.notifications": "通知設定",
  "personal.settings.general": "一般個人資料",
  "personal.settings.displayName": "顯示名稱",
  "personal.settings.email": "電子郵件地址",
  "personal.settings.language": "語言與地區",
  "personal.settings.cancel": "取消",
  "personal.settings.save": "儲存變更",
  "personal.common.loading": "載入中..."
}

new_keys_en = {
  "personal.following.title": "Tracked Documents",
  "personal.following.desc": "Your personalized collection of bookmarked knowledge and documents.",
  "personal.following.empty.title": "No documents tracked",
  "personal.following.empty.desc": "Bookmark documents in the Knowledge Center to see them here.",
  
  "personal.review.title": "Pending Reviews",
  "personal.review.desc": "Documents and records awaiting your approval.",
  "personal.review.empty.title": "All caught up!",
  "personal.review.empty.desc": "You have no pending reviews at the moment.",
  "personal.review.approve": "Approve",
  "personal.review.reject": "Reject",
  "personal.review.pending": "Pending",
  
  "personal.points.title": "Points",
  "personal.points.desc": "Your total contribution score.",
  "personal.points.info": "Points are automatically awarded when your knowledge submissions are approved or when you assist others.",
  "personal.points.recent": "Recent Activity",
  "personal.points.empty": "No point activity yet.",
  
  "personal.projects.title": "My Projects",
  "personal.projects.desc": "Track your active projects and milestones.",
  "personal.projects.viewAll": "View All Projects",
  "personal.projects.empty.title": "No active projects",
  "personal.projects.empty.desc": "You are not currently assigned to any active projects.",
  "personal.projects.manager": "Manager:",
  "personal.projects.error": "Failed to load project data. Please verify the backend service.",
  
  "personal.tasks.title": "My Tasks",
  "personal.tasks.desc": "Manage your personal to-dos and workflow tasks.",
  "personal.tasks.new": "New Task",
  "personal.tasks.pending": "Pending",
  "personal.tasks.completed": "Completed",
  "personal.tasks.due": "Due:",
  "personal.tasks.empty": "No pending tasks!",
  "personal.tasks.prompt": "Task Title:",
  
  "personal.announcements.title": "Announcements",
  "personal.announcements.desc": "Important news and personal alerts.",
  "personal.announcements.empty.title": "You're all caught up!",
  "personal.announcements.empty.desc": "No new announcements at this time.",
  
  "personal.status.title": "Personal Status",
  "personal.status.desc": "Your daily punch records and attendance overview.",
  "personal.status.punch": "Daily Punch",
  "personal.status.punchIn": "Punch In",
  "personal.status.punchOut": "Punch Out",
  "personal.status.overview": "Attendance Overview",
  "personal.status.late": "Late (This Month)",
  "personal.status.leave": "Leave Hours",
  "personal.status.pto": "Remaining PTO",
  "personal.status.days": "Days",
  
  "personal.phoneRecords.title": "Phone Records",
  "personal.phoneRecords.desc": "Manage and track your incoming calls and notes.",
  "personal.phoneRecords.add": "Add Record",
  "personal.phoneRecords.search": "Search phone records...",
  "personal.phoneRecords.loading": "Loading records...",
  "personal.phoneRecords.empty": "No phone records found",
  
  "personal.memos.title": "Memos & Notes",
  "personal.memos.desc": "Your personal sticky notes board.",
  "personal.memos.new": "New Memo",
  "personal.memos.search": "Search memos...",
  "personal.memos.empty": "No memos found",
  
  "personal.directory.title": "Address Book",
  "personal.directory.desc": "Find and connect with colleagues across the company.",
  "personal.directory.search": "Search by name, email, or title...",
  "personal.directory.allDepts": "All Departments",
  "personal.directory.empty": "No colleagues found matching your criteria",
  
  "personal.settings.title": "Account Settings",
  "personal.settings.desc": "Manage your preferences, security, and notifications.",
  "personal.settings.profile": "Profile & Preferences",
  "personal.settings.security": "Security & Login",
  "personal.settings.notifications": "Notifications",
  "personal.settings.general": "General Profile",
  "personal.settings.displayName": "Display Name",
  "personal.settings.email": "Email Address",
  "personal.settings.language": "Language / Region",
  "personal.settings.cancel": "Cancel",
  "personal.settings.save": "Save Changes",
  "personal.common.loading": "Loading..."
}

def update_json(file_path, new_keys):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    data.update(new_keys)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Updated {file_path}")

update_json('/Volumes/workspace/ai/application/cortex/frontend/src/i18n/zh-TW.json', new_keys_zh)
update_json('/Volumes/workspace/ai/application/cortex/frontend/src/i18n/en.json', new_keys_en)
