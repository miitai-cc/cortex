const zh: Record<string, string> = {
  'workflow.cannotDeleteDefault': '預設流程不可刪除', 'workflow.clear': '清空', 'workflow.clickToRun': '執行流程',
  'workflow.collapsePanel': '收合屬性面板', 'workflow.collapseToolbar': '收合節點工具列',
  'workflow.confirmClear': '確定清空目前畫布？', 'workflow.confirmDeleteWorkflow': '確定刪除流程「{{name}}」？',
  'workflow.confirmReload': '確定重新載入並放棄未儲存變更？', 'workflow.delete': '刪除',
  'workflow.deleteError': '刪除流程時發生錯誤', 'workflow.deleteFailed': '刪除失敗：',
  'workflow.deleteNode': '刪除節點', 'workflow.deleteSuccess': '流程已封存', 'workflow.execute': '執行',
  'workflow.executeError': '執行流程時發生錯誤', 'workflow.executeFailed': '執行失敗：',
  'workflow.executeSuccess': '流程已排入執行：', 'workflow.expandPanel': '展開屬性面板',
  'workflow.expandToolbar': '展開節點工具列', 'workflow.fullscreen': '全螢幕', 'workflow.new': '新增流程',
  'workflow.newNodeTitle': '流程名稱／新增節點', 'workflow.propertyTitle': '節點屬性', 'workflow.reload': '重新載入',
  'workflow.save': '儲存草稿', 'workflow.saveError': '儲存流程時發生錯誤', 'workflow.saveFailed': '儲存失敗：',
  'workflow.saveSuccess': '流程草稿與新版本已儲存', 'workflow.selectNodeHint': '點選節點以編輯屬性',
  'workflow.unsaved': '未儲存', 'workflow.publish': '發佈', 'workflow.publishSuccess': '流程已發佈',
  'workflow.publishFailed': '流程發佈失敗：',
  'workflow.contextMenu.delete': '刪除', 'workflow.contextMenu.moveBack': '移到最下層',
  'workflow.contextMenu.moveDown': '下移一層', 'workflow.contextMenu.moveFront': '移到最上層',
  'workflow.contextMenu.moveUp': '上移一層',
  'workflow.nodes.agentPrompt': 'AI Agent', 'workflow.nodes.end': '結束', 'workflow.nodes.notSet': '尚未設定',
  'workflow.nodes.notSetExpr': '尚未設定運算式', 'workflow.nodes.notSetVar': '尚未設定變數',
  'workflow.nodes.noteHint': '輸入備註內容', 'workflow.nodes.promptLabel': 'Prompt／指示',
  'workflow.nodes.promptPlaceholder': '輸入此節點的處理指示…', 'workflow.nodes.selectPlaceholder': '請選擇',
  'workflow.nodes.start': '開始', 'workflow.nodes.startNode': '開始節點', 'workflow.nodes.swimLane': '泳道',
  'workflow.properties.alignBottom': '靠下', 'workflow.properties.alignCenter': '置中',
  'workflow.properties.alignLeft': '靠左', 'workflow.properties.alignRight': '靠右',
  'workflow.properties.alignTop': '靠上', 'workflow.properties.autoSize': '自動尺寸',
  'workflow.properties.autoSizeDesc': '依內容調整', 'workflow.properties.bgColor': '背景色',
  'workflow.properties.bold': '粗體', 'workflow.properties.bottom': '下方',
  'workflow.properties.calculator': '計算機', 'workflow.properties.condition': '條件運算式',
  'workflow.properties.conditionPlaceholder': '例如 amount > 1000', 'workflow.properties.database': '資料庫',
  'workflow.properties.expression': '計算運算式', 'workflow.properties.expressionPlaceholder': '例如 amount * 1.05',
  'workflow.properties.fetchUrl': '擷取 URL', 'workflow.properties.fileSystem': '檔案系統',
  'workflow.properties.fontFamily': '字型', 'workflow.properties.fontSize': '字級',
  'workflow.properties.handwriting': '手寫', 'workflow.properties.horizontal': '水平',
  'workflow.properties.italic': '斜體', 'workflow.properties.json': 'JSON', 'workflow.properties.label': '標籤',
  'workflow.properties.large': '大', 'workflow.properties.left': '左側', 'workflow.properties.manual': '手動',
  'workflow.properties.markdown': 'Markdown', 'workflow.properties.mcp': 'MCP 服務',
  'workflow.properties.mcpWebSearch': 'MCP 網頁搜尋', 'workflow.properties.medium': '中',
  'workflow.properties.model': 'AI 模型', 'workflow.properties.monospace': '等寬',
  'workflow.properties.noteContent': '備註內容', 'workflow.properties.orientation': '方向',
  'workflow.properties.outputFormat': '輸出格式', 'workflow.properties.prompt': 'Prompt／指示',
  'workflow.properties.promptPlaceholder': '可使用 {{payload}} 帶入流程輸入', 'workflow.properties.research': '研究',
  'workflow.properties.right': '右側', 'workflow.properties.sansSerif': '無襯線',
  'workflow.properties.schedule': '排程', 'workflow.properties.serif': '襯線', 'workflow.properties.skill': 'Skill',
  'workflow.properties.small': '小', 'workflow.properties.style': '樣式', 'workflow.properties.summarize': '摘要',
  'workflow.properties.swimLaneTitle': '泳道標題', 'workflow.properties.swimLaneTitlePlaceholder': '輸入角色或階段',
  'workflow.properties.temperature': 'Temperature', 'workflow.properties.text': '純文字',
  'workflow.properties.textAlign': '水平對齊', 'workflow.properties.titlePosition': '標題位置',
  'workflow.properties.toolParams': '工具參數（JSON）', 'workflow.properties.toolParamsPlaceholder': '{"query":"..."}',
  'workflow.properties.toolType': '工具類型', 'workflow.properties.top': '上方',
  'workflow.properties.translate': '翻譯', 'workflow.properties.triggerType': '觸發方式',
  'workflow.properties.varName': '變數名稱', 'workflow.properties.varNamePlaceholder': '例如 amount',
  'workflow.properties.varValue': '變數值', 'workflow.properties.varValuePlaceholder': '可輸入 JSON 或 {{payload}}',
  'workflow.properties.vertical': '垂直', 'workflow.properties.verticalAlign': '垂直對齊',
  'workflow.properties.webSearch': '網頁搜尋', 'workflow.properties.webhook': 'Webhook',
  'workflow.properties.xlarge': '特大', 'workflow.properties.executionMode': '執行模式',
  'workflow.properties.automatic': '自動執行', 'workflow.properties.humanTask': '人工工作／審核',
  'workflow.properties.assignee': '指派對象', 'workflow.properties.initiator': '流程發起人',
  'workflow.properties.dueDays': '處理期限（天）',
  'workflow.toolbar.agent': 'AI Agent', 'workflow.toolbar.agentTitle': '加入 AI Agent 節點',
  'workflow.toolbar.basic': '一般工作', 'workflow.toolbar.basicTitle': '加入自動或人工工作節點',
  'workflow.toolbar.calc': '計算', 'workflow.toolbar.calcTitle': '加入計算節點',
  'workflow.toolbar.cond': '條件', 'workflow.toolbar.condTitle': '加入條件分支節點',
  'workflow.toolbar.end': '結束', 'workflow.toolbar.endTitle': '加入結束節點',
  'workflow.toolbar.mcp': 'MCP', 'workflow.toolbar.mcpTitle': '加入 MCP 節點',
  'workflow.toolbar.note': '備註', 'workflow.toolbar.noteTitle': '加入備註',
  'workflow.toolbar.skill': 'Skill', 'workflow.toolbar.skillTitle': '加入 Skill 節點',
  'workflow.toolbar.start': '開始', 'workflow.toolbar.startTitle': '加入開始節點',
  'workflow.toolbar.swimLane': '泳道', 'workflow.toolbar.swimLaneTitle': '加入泳道',
  'workflow.toolbar.tool': '工具', 'workflow.toolbar.toolTitle': '加入工具節點',
  'workflow.toolbar.variable': '變數', 'workflow.toolbar.variableTitle': '加入變數節點',
};

const englishOverrides: Record<string, string> = {
  'workflow.confirmClear': 'Clear the current canvas?',
  'workflow.confirmDeleteWorkflow': 'Archive workflow “{{name}}”?',
  'workflow.confirmReload': 'Reload and discard unsaved changes?',
  'workflow.saveSuccess': 'Draft and a new workflow version were saved',
  'workflow.publishSuccess': 'Workflow published',
  'workflow.executeSuccess': 'Workflow queued: ',
  'workflow.selectNodeHint': 'Select a node to edit its properties',
  'workflow.properties.humanTask': 'Human task / approval',
  'workflow.properties.initiator': 'Workflow initiator',
};

function humanize(key: string) {
  const value = key.split('.').pop() ?? key;
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (character) => character.toUpperCase());
}

export function workflowEditorTranslate(language: string, key: string, params?: Record<string, unknown>) {
  let value = language.toLowerCase().startsWith('zh') ? zh[key] : englishOverrides[key] ?? humanize(key);
  value ??= humanize(key);
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replace(`{{${name}}}`, String(replacement));
  }
  return value;
}
