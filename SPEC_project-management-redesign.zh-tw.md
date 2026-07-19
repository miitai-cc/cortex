# 專案管理子模組重新設計規格書

## 概述

將「專案管理」下的 16 個子模組從單一 `ProjectManagementPage.tsx` 重構為獨立頁面，每個模組擁有獨特的 UI/UX 設計，不再使用通用範本。

---

## 模組清單與獨立設計

### 1. 專案資訊 (information)
- **路徑**: `/cortex/projects/information`
- **佈局**: 雙欄式 Dashboard
- **左欄 (60%)**: 專案主檔卡片（代碼、名稱、狀態、說明、經理、期間、預算、優先順序）
- **右欄 (40%)**: 
  - 相關連結列表（可點擊外部連結）
  - 團隊協作入口（連結至協作頻道）
  - 專案時間軸（迷你 Gantt 預覽）
- **特色**: 專案選擇器置頂，支援快速切換專案

### 2. Gantt Chart (gantt)
- **路徑**: `/cortex/projects/gantt`
- **佈局**: 全寬時間軸視圖
- **功能**:
  - 可縮放時間軸（日/週/月/季）
  - 任務與里程碑以橫條顯示，支援拖曳調整日期
  - 相依關係連線（FS/SS/FF/SF）
  - 關鍵路徑高亮
  - 今日標記線
- **工具列**: 縮放控制、篩選（任務/里程碑）、全螢幕、匯出

### 3. 工作日曆 (calendar)
- **路徑**: `/cortex/projects/calendar`
- **佈局**: 月曆視圖 + 側邊面板
- **功能**:
  - 月曆顯示任務、里程碑、會議
  - 顏色區分（任務=藍、里程碑=紫、會議=橙）
  - 點擊日期顯示當日詳情面板
  - 支援切換週視圖
  - 今日快速跳轉

### 4. Milestone 管理 (milestones)
- **路徑**: `/cortex/projects/milestones`
- **佈局**: 時間軸 + 卡片混排
- **功能**:
  - 垂直時間軸顯示里程碑
  - 每個里程碑顯示：名稱、日期、負責人、交付成果、完成進度
  - 里程碑間顯示相依關係
  - 支援拖曳調整順序
  - 篩選：全部/進行中/已完成/延遲

### 5. Kanban 工作管理 (kanban)
- **路徑**: `/cortex/projects/kanban`
- **佈局**: 多欄看板
- **功能**:
  - 5 欄看板（需求池/待處理/進行中/待審核/完成）
  - 每欄顯示工作卡片（標題、負責人、進度、優先順序）
  - 拖曳卡片切換狀態
  - WIP 限制（進行中欄位上限）
  - 篩選：負責人、優先順序、關鍵字
  - 統計：各欄數量、完成率

### 6. 會議記錄 (meetings)
- **路徑**: `/cortex/projects/meetings`
- **佈局**: 會議卡片列表 + 詳情面板
- **功能**:
  - 會議卡片（日期、時間、地點、參與者、狀態）
  - 點擊展開詳情：議程、決議事項、待辦事項
  - 新增會議表單（含時間選擇、參與者多選）
  - 篩選：即將到來/已完成/已取消

### 7. 郵件整理 (emails)
- **路徑**: `/cortex/projects/emails`
- **佈局**: 郵件列表 + 預覽面板
- **功能**:
  - 三欄佈局（分類列表/郵件列表/郵件預覽）
  - 分類：收件/寄件/已歸檔
  - 郵件卡片（寄件人、主旨、日期、標籤）
  - 預覽面板顯示郵件內容
  - 新增郵件記錄（寄件人、收件人、主旨、內容）

### 8. 專案預算 (budget)
- **路徑**: `/cortex/projects/budget`
- **佈局**: 財務儀表板
- **功能**:
  - 預算總覽卡片（核定預算/已支出/承諾/剩餘）
  - 圓餅圖顯示預算分配
  - 柱狀圖顯示月度支出趨勢
  - 預算科目列表（類別、金額、狀態、供應商）
  - 支出紀錄表格
  - 預算使用率警示

### 9. 專案人員 (people)
- **路徑**: `/cortex/projects/people`
- **佈局**: 人員卡片牆 + 分配視圖
- **功能**:
  - 人員卡片（頭像、姓名、角色、投入比例、聯絡方式）
  - 投入比例甘特圖（時間軸顯示各成員投入）
  - 新增成員表單（選擇成員、設定角色、投入比例）
  - 統計：總人數、各角色分佈
  - 篩選：角色、狀態

### 10. 需求管理 (requirements)
- **路徑**: `/cortex/projects/requirements`
- **佈局**: 需求樹狀結構 + 詳情
- **功能**:
  - 需求階層列表（父需求/子需求）
  - 每個需求顯示：標題、來源、優先順序、負責人、驗收條件、狀態
  - 需求追溯矩陣（需求→設計→測試案例）
  - 新增需求表單（含驗收條件、優先順序）
  - 篩選：狀態、優先順序、負責人

### 11. 風險管理 (risks)
- **路徑**: `/cortex/projects/risks`
- **佈局**: 風險矩陣 + 風險清單
- **功能**:
  - 5×5 風險矩陣（可能性 × 影響程度）
  - 風險點在矩陣中的位置
  - 風險清單（描述、等級、負責人、因應措施、狀態）
  - 新增風險表單（可能性、影響程度、因應策略）
  - 風險統計：高/中/低風險數量

### 12. 成果稽核 (audits)
- **路徑**: `/cortex/projects/audits`
- **佈局**: 稽核清單 + 檢查表
- **功能**:
  - 稽核記錄卡片（日期、稽核項目、結果、負責人）
  - 檢查表視圖（勾選各項稽核項目）
  - 稽核證據上傳
  - 缺失追蹤清單
  - 篩選：通過/未通過/追蹤改善

### 13. 報告 (reports)
- **路徑**: `/cortex/projects/reports`
- **佈局**: 報告生成器 + 報告列表
- **功能**:
  - 報告範本選擇（週報/月報/結案報告）
  - 報告預覽（含圖表、統計、文字）
  - 匯出功能（PDF/Excel）
  - 歷史報告列表
  - 自訂報告範圍（日期區間、模組選擇）

### 14. 資源管理 (resources)
- **路徑**: `/cortex/projects/resources`
- **佈局**: 資源時間軸 + 使用率
- **功能**:
  - 資源時間軸（顯示各資源的使用排程）
  - 使用率 Heatmap（颜色深淺表示使用率）
  - 資源清單（名稱、類型、可用性、成本）
  - 資源衝突警示
  - 新增資源（名稱、類型、成本、可用性）

### 15. 客戶管理 (customers)
- **路徑**: `/cortex/projects/customers`
- **佈局**: 客戶卡片牆 + 詳情面板
- **功能**:
  - 客戶卡片（公司名稱、聯絡人、電話、Email、狀態）
  - 點擊展開詳情：合約、互動紀錄、專案關聯
  - 新增客戶表單（公司名稱、聯絡人、聯絡方式）
  - 篩選：活躍/非活躍
  - 搜尋：公司名稱、聯絡人

### 16. 廠商管理 (vendors)
- **路徑**: `/cortex/projects/vendors`
- **佈局**: 廠商比較表 + 詳情
- **功能**:
  - 廠商比較表格（名稱、統編、聯絡人、電話、狀態、合作項目）
  - 廠商評分（1-5星）
  - 合約管理（合約期間、金額、付款條件）
  - 新增廠商表單（含統一編號、聯絡人、評估狀態）
  - 篩選：合作中/評估中/已終止

---

## 後端 API 設計

### 專案管理 API (已有)
```
GET    /api/projects                    # 專案總覽
POST   /api/projects                    # 建立專案
PUT    /api/projects/:id                # 更新專案
DELETE /api/projects/:id                # 刪除專案
GET    /api/projects/personal           # 個人專案總覽
```

### 專案紀錄 API (已有)
```
POST   /api/projects/:id/records/:type  # 新增紀錄
PUT    /api/projects/:id/records/:type/:rid  # 更新紀錄
DELETE /api/projects/:id/records/:type/:rid  # 刪除紀錄
```

### 新增 API 端點

#### 風險管理
```
GET    /api/projects/:id/risks          # 風險清單
POST   /api/projects/:id/risks          # 新增風險
PUT    /api/projects/:id/risks/:rid     # 更新風險
DELETE /api/projects/:id/risks/:rid     # 刪除風險
GET    /api/projects/:id/risks/matrix   # 風險矩陣資料
```

#### 報告管理
```
GET    /api/projects/:id/reports        # 報告列表
POST   /api/projects/:id/reports/generate  # 生成報告
GET    /api/projects/:id/reports/:rid   # 報告詳情
GET    /api/projects/:id/reports/:rid/download  # 下載報告
```

#### 資源管理
```
GET    /api/projects/:id/resources      # 資源清單
POST   /api/projects/:id/resources      # 新增資源
PUT    /api/projects/:id/resources/:rid # 更新資源
DELETE /api/projects/:id/resources/:rid # 刪除資源
GET    /api/projects/:id/resources/timeline  # 資源時間軸
```

---

## 實施計畫

### Phase 1: 基礎架構
1. 建立各模組獨立頁面元件
2. 重構路由配置
3. 更新導航配置

### Phase 2: 核心模組
1. 專案資訊 (information)
2. Gantt Chart (gantt)
3. Kanban 工作管理 (kanban)
4. 專案預算 (budget)
5. 專案人員 (people)

### Phase 3: 進階模組
1. 需求管理 (requirements)
2. 風險管理 (risks)
3. 成果稽核 (audits)
4. 報告 (reports)
5. 資源管理 (resources)

### Phase 4: 輔助模組
1. 工作日曆 (calendar)
2. Milestone 管理 (milestones)
3. 會議記錄 (meetings)
4. 郵件整理 (emails)
5. 客戶管理 (customers)
6. 廠商管理 (vendors)
