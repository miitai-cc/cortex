import json
import os
import re

new_keys_zh = {
    "dept.status.planned": "規劃中",
    "dept.status.active": "進行中",
    "dept.status.pending_review": "待審核",
    "dept.status.blocked": "受阻",
    "dept.status.completed": "已完成",
    "dept.status.archived": "已封存",
    "dept.priority.low": "低",
    "dept.priority.medium": "中",
    "dept.priority.high": "高",
    "dept.priority.critical": "關鍵",
    "dept.stats.total": "所有項目",
    "dept.stats.active": "進行中",
    "dept.stats.dueThisMonth": "本月到期",
    "dept.stats.pending": "待審核",
    "dept.filters.all": "顯示全部",
    "dept.filters.my": "只看我的",
    "dept.filters.type": "類型篩選",
    "dept.filters.status": "狀態篩選",
    "dept.item.owner": "負責人：",
    "dept.item.unassigned": "未指派",
    "dept.item.dueDate": "期限：",
    "dept.item.amount": "金額：",
    "dept.item.updated": "更新：",
    "dept.item.prioritySuffix": "優先",
    "dept.action.new": "新增工作項目",
    "dept.action.edit": "編輯工作項目",
    "dept.action.editBtn": "編輯",
    "dept.action.deleteBtn": "刪除",
    "dept.action.retry": "重試",
    "dept.action.cancel": "取消",
    "dept.action.save": "儲存變更",
    "dept.action.create": "建立項目",
    "dept.empty.title": "目前沒有符合條件的項目",
    "dept.empty.desc": "可調整篩選，或建立第一筆部門工作項目。",
    "dept.form.type": "項目類型",
    "dept.form.owner": "負責人 (選填)",
    "dept.form.ownerPlaceholder": "未填時使用目前使用者",
    "dept.form.title": "標題",
    "dept.form.titlePlaceholder": "輸入清楚、可執行的工作標題",
    "dept.form.desc": "描述 (選填)",
    "dept.form.descPlaceholder": "描述背景、目標、交付內容與完成條件",
    "dept.form.status": "狀態",
    "dept.form.priority": "優先級",
    "dept.form.dueDate": "到期日 (選填)",
    "dept.form.amount": "金額（TWD）",
    "dept.msg.loadError": "載入部門設定失敗",
    "dept.msg.titleEmpty": "標題不能為空",
    "dept.msg.saveSuccess": "儲存成功",
    "dept.msg.deleteSuccess": "刪除成功",
    "dept.error": "錯誤"
}

new_keys_en = {
    "dept.status.planned": "Planned",
    "dept.status.active": "Active",
    "dept.status.pending_review": "Pending Review",
    "dept.status.blocked": "Blocked",
    "dept.status.completed": "Completed",
    "dept.status.archived": "Archived",
    "dept.priority.low": "Low",
    "dept.priority.medium": "Medium",
    "dept.priority.high": "High",
    "dept.priority.critical": "Critical",
    "dept.stats.total": "Total Items",
    "dept.stats.active": "Active",
    "dept.stats.dueThisMonth": "Due This Month",
    "dept.stats.pending": "Pending Review",
    "dept.filters.all": "Show All",
    "dept.filters.my": "Only Mine",
    "dept.filters.type": "Filter by Type",
    "dept.filters.status": "Filter by Status",
    "dept.item.owner": "Owner: ",
    "dept.item.unassigned": "Unassigned",
    "dept.item.dueDate": "Due: ",
    "dept.item.amount": "Amount: ",
    "dept.item.updated": "Updated: ",
    "dept.item.prioritySuffix": " Priority",
    "dept.action.new": "New Item",
    "dept.action.edit": "Edit Item",
    "dept.action.editBtn": "Edit",
    "dept.action.deleteBtn": "Delete",
    "dept.action.retry": "Retry",
    "dept.action.cancel": "Cancel",
    "dept.action.save": "Save Changes",
    "dept.action.create": "Create Item",
    "dept.empty.title": "No items match your criteria",
    "dept.empty.desc": "Adjust filters or create your first department item.",
    "dept.form.type": "Item Type",
    "dept.form.owner": "Owner (Optional)",
    "dept.form.ownerPlaceholder": "Defaults to current user if empty",
    "dept.form.title": "Title",
    "dept.form.titlePlaceholder": "Enter a clear, actionable title",
    "dept.form.desc": "Description (Optional)",
    "dept.form.descPlaceholder": "Describe background, goals, and deliverables",
    "dept.form.status": "Status",
    "dept.form.priority": "Priority",
    "dept.form.dueDate": "Due Date (Optional)",
    "dept.form.amount": "Amount (Local Currency)",
    "dept.msg.loadError": "Failed to load department configuration",
    "dept.msg.titleEmpty": "Title cannot be empty",
    "dept.msg.saveSuccess": "Saved successfully",
    "dept.msg.deleteSuccess": "Deleted successfully",
    "dept.error": "Error"
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

# Now patch the TSX file
file_path = '/Volumes/workspace/ai/application/cortex/frontend/src/pages/workspace/DepartmentPortalPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# I18n translation hook is already imported (useTranslation).
# But the component might use translation inside functions or outside.
# The arrays 'statuses' and 'priorities' are outside the component!
# We need to move them inside or use t() where they are rendered.
# We'll use t() where they are rendered.

# For statuses array outside, we can change it to use keys.
content = content.replace("label: '規劃中'", "labelKey: 'dept.status.planned'")
content = content.replace("label: '進行中'", "labelKey: 'dept.status.active'")
content = content.replace("label: '待審核'", "labelKey: 'dept.status.pending_review'")
content = content.replace("label: '受阻'", "labelKey: 'dept.status.blocked'")
content = content.replace("label: '已完成'", "labelKey: 'dept.status.completed'")
content = content.replace("label: '已封存'", "labelKey: 'dept.status.archived'")

content = content.replace("label: '低'", "labelKey: 'dept.priority.low'")
content = content.replace("label: '中'", "labelKey: 'dept.priority.medium'")
content = content.replace("label: '高'", "labelKey: 'dept.priority.high'")
content = content.replace("label: '關鍵'", "labelKey: 'dept.priority.critical'")

# Also fix the type definition of statuses if needed, but it's implicit in JS/TS.
content = content.replace("label: string }>", "labelKey: string }>")

# Update render usages of statuses and priorities
content = content.replace("statusLabel(item.status)", "t(`dept.status.${item.status}`)")
content = content.replace("priorityLabel(item.priority)", "t(`dept.priority.${item.priority}`)")
content = content.replace("{status.label}", "{t(status.labelKey)}")
content = content.replace("{priority.label}", "{t(priority.labelKey)}")

# Text replacements inside the component
reps = {
    "'載入部門設定失敗'": "t('dept.msg.loadError')",
    "toast.error('標題不能為空')": "toast.error(t('dept.msg.titleEmpty'))",
    "'儲存成功'": "t('dept.msg.saveSuccess')",
    "'刪除成功'": "t('dept.msg.deleteSuccess')",
    "toast.error('錯誤')": "toast.error(t('dept.error'))",
    
    # Stats
    ">所有項目<": ">{t('dept.stats.total')}<",
    ">進行中<": ">{t('dept.stats.active')}<",
    ">本月到期<": ">{t('dept.stats.dueThisMonth')}<",
    ">待審核<": ">{t('dept.stats.pending')}<",
    
    # Buttons
    ">新增工作項目<": ">{t('dept.action.new')}<",
    ">顯示全部<": ">{t('dept.filters.all')}<",
    ">只看我的<": ">{t('dept.filters.my')}<",
    ">類型篩選<": ">{t('dept.filters.type')}<",
    ">狀態篩選<": ">{t('dept.filters.status')}<",
    ">重試<": ">{t('dept.action.retry')}<",
    ">取消<": ">{t('dept.action.cancel')}<",
    
    # Item details
    "負責人：{": "{t('dept.item.owner')}{",
    "'未指派'": "t('dept.item.unassigned')",
    "期限：{": "{t('dept.item.dueDate')}{",
    "金額：{": "{t('dept.item.amount')}{",
    "更新：{": "{t('dept.item.updated')}{",
    "}優先<": "}{t('dept.item.prioritySuffix')}<",
    
    # Tooltips
    'title="編輯"': 'title={t("dept.action.editBtn")}',
    'title="刪除"': 'title={t("dept.action.deleteBtn")}',
    
    # Empty State
    ">目前沒有符合條件的項目<": ">{t('dept.empty.title')}<",
    ">可調整篩選，或建立第一筆部門工作項目。<": ">{t('dept.empty.desc')}<",
    
    # Form
    "editing ? '編輯工作項目' : '新增工作項目'": "editing ? t('dept.action.edit') : t('dept.action.new')",
    ">項目類型<": ">{t('dept.form.type')}<",
    ">負責人 (選填)<": ">{t('dept.form.owner')}<",
    'placeholder="未填時使用目前使用者"': 'placeholder={t("dept.form.ownerPlaceholder")}',
    ">標題 ": ">{t('dept.form.title')} ",
    'placeholder="輸入清楚、可執行的工作標題"': 'placeholder={t("dept.form.titlePlaceholder")}',
    ">描述 (選填)<": ">{t('dept.form.desc')}<",
    'placeholder="描述背景、目標、交付內容與完成條件"': 'placeholder={t("dept.form.descPlaceholder")}',
    ">狀態<": ">{t('dept.form.status')}<",
    ">優先級<": ">{t('dept.form.priority')}<",
    ">到期日 (選填)<": ">{t('dept.form.dueDate')}<",
    ">金額（TWD）<": ">{t('dept.form.amount')}<",
    
    "editing ? '儲存變更' : '建立項目'": "editing ? t('dept.action.save') : t('dept.action.create')",
}

for old, new in reps.items():
    content = content.replace(old, new)

# dynamic title/desc using i18n language
# The component uses `const { t } = useTranslation();`
# But it also needs i18n instance to check language `i18n.language`
content = content.replace(
    "const { t } = useTranslation();", 
    "const { t, i18n } = useTranslation();\n  const isEn = i18n.language?.startsWith('en');"
)
# Update config title/desc usage
content = content.replace("{config.title}", "{isEn && config.titleEn ? config.titleEn : config.title}")
content = content.replace("{config.description}", "{isEn && config.descriptionEn ? config.descriptionEn : config.description}")
content = content.replace("config.title + ' | Cortex'", "(isEn && config.titleEn ? config.titleEn : config.title) + ' | Cortex'")

# In the form, the title/focus
content = content.replace("{config.focus}", "{config.focus} {/* TODO: Add focus translation if needed */}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Updated {file_path}")
