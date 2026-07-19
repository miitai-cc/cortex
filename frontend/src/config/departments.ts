import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Building2,
  ClipboardList,
  Code2,
  Handshake,
  Landmark,
  MonitorCog,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type DepartmentSlug =
  | 'ceo'
  | 'cfo'
  | 'cto'
  | 'sales'
  | 'administration'
  | 'hr'
  | 'procurement'
  | 'mis'
  | 'sales-projects'
  | 'it-projects'
  | 'information-security';

export interface DepartmentItemTypeConfig {
  value: string;
  label: string;
  labelEn: string;
  description: string;
  linkTo?: string;
}

export interface DepartmentConfig {
  slug: DepartmentSlug;
  navKey: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  focus: string;
  icon: LucideIcon;
  accent: string;
  accentSoft: string;
  supportsAmount?: boolean;
  itemTypes: DepartmentItemTypeConfig[];
}

export const departmentConfigs: DepartmentConfig[] = [
  {
    slug: 'ceo',
    navKey: 'nav.departments.ceo',
    title: 'CEO 決策專區',
    titleEn: 'CEO Executive Office',
    description: '聚焦公司策略、經營指標、重大決策與企業級風險。',
    descriptionEn: 'Corporate strategy, executive KPIs, key decisions and enterprise risks.',
    focus: '策略治理與跨部門決策',
    icon: Building2,
    accent: 'text-violet-700 dark:text-violet-300',
    accentSoft: 'bg-violet-50 dark:bg-violet-900/20',
    itemTypes: [
      { value: 'strategy', label: '策略議題', labelEn: 'Strategy', description: '中長期策略、年度目標與策略執行追蹤' },
      { value: 'kpi', label: '經營 KPI', labelEn: 'Executive KPI', description: '公司級關鍵指標與異常改善行動' },
      { value: 'decision', label: '決策事項', labelEn: 'Decision', description: '需主管決策、授權或跨部門協調的議題' },
      { value: 'enterprise_risk', label: '企業風險', labelEn: 'Enterprise Risk', description: '影響營運、財務或聲譽的重大風險' },
    ],
  },
  {
    slug: 'cfo',
    navKey: 'nav.departments.cfo',
    title: 'CFO 財務專區',
    titleEn: 'CFO Finance Office',
    description: '管理預算、費用、現金流與重要財務簽核。',
    descriptionEn: 'Budgets, expenses, cash flow and major financial approvals.',
    focus: '財務治理與資金效益',
    icon: BadgeDollarSign,
    accent: 'text-emerald-700 dark:text-emerald-300',
    accentSoft: 'bg-emerald-50 dark:bg-emerald-900/20',
    supportsAmount: true,
    itemTypes: [
      { value: 'budget', label: '預算管理', labelEn: 'Budget', description: '年度預算、部門預算與預實差追蹤' },
      { value: 'expense', label: '費用管控', labelEn: 'Expense', description: '重大費用、成本改善與支出檢視' },
      { value: 'cashflow', label: '現金流', labelEn: 'Cash Flow', description: '現金部位、收付款與資金需求預測' },
      { value: 'financial_approval', label: '財務簽核', labelEn: 'Financial Approval', description: '投資、採購與重大財務事項核決' },
    ],
  },
  {
    slug: 'cto',
    navKey: 'nav.departments.cto',
    title: 'CTO 技術專區',
    titleEn: 'CTO Technology Office',
    description: '維護技術藍圖、架構決策、創新提案與技術風險。',
    descriptionEn: 'Technology roadmaps, architecture decisions, innovation and technical risks.',
    focus: '技術策略與架構治理',
    icon: Code2,
    accent: 'text-blue-700 dark:text-blue-300',
    accentSoft: 'bg-blue-50 dark:bg-blue-900/20',
    itemTypes: [
      { value: 'roadmap', label: '技術藍圖', labelEn: 'Roadmap', description: '平台演進、技術投資與能力建設規劃' },
      { value: 'architecture', label: '架構決策', labelEn: 'Architecture', description: '架構原則、ADR 與跨系統技術標準' },
      { value: 'innovation', label: '創新提案', labelEn: 'Innovation', description: '新技術評估、PoC 與導入效益' },
      { value: 'technical_risk', label: '技術風險', labelEn: 'Technical Risk', description: '技術債、容量、可靠性與供應鏈風險' },
    ],
  },
  {
    slug: 'sales',
    navKey: 'nav.departments.sales',
    title: 'SALES 業務專區',
    titleEn: 'Sales Office',
    description: '追蹤商機、銷售漏斗、預測與客戶行動。',
    descriptionEn: 'Opportunities, sales pipeline, forecasts and customer actions.',
    focus: '營收成長與客戶經營',
    icon: BriefcaseBusiness,
    accent: 'text-orange-700 dark:text-orange-300',
    accentSoft: 'bg-orange-50 dark:bg-orange-900/20',
    supportsAmount: true,
    itemTypes: [
      { value: 'opportunity', label: '商機', labelEn: 'Opportunity', description: '客戶需求、預估金額與成交進度' },
      { value: 'pipeline', label: '銷售漏斗', labelEn: 'Pipeline', description: '各階段案件量、轉換與推進阻礙' },
      { value: 'forecast', label: '業績預測', labelEn: 'Forecast', description: '月季營收預估、承諾與落差說明' },
      { value: 'customer_action', label: '客戶行動', labelEn: 'Customer Action', description: '拜訪、提案、報價與後續跟進' },
    ],
  },
  {
    slug: 'administration',
    navKey: 'nav.departments.administration',
    title: '行政管理專區',
    titleEn: 'Administration Office',
    description: '集中公告、設施、綜合申請與行政資產管理。',
    descriptionEn: 'Announcements, facilities, general requests and administrative assets.',
    focus: '行政服務與營運支援',
    icon: Landmark,
    accent: 'text-slate-700 dark:text-slate-300',
    accentSoft: 'bg-slate-100 dark:bg-slate-700/50',
    itemTypes: [
      { value: 'announcement', label: '公司公告', labelEn: 'Announcement', description: '政策、活動與全公司行政通知' },
      { value: 'facility', label: '設施管理', labelEn: 'Facility', description: '辦公環境、空間與設施維護' },
      { value: 'general_request', label: '綜合申請', labelEn: 'General Request', description: '庶務、用印、會議與行政支援申請' },
      { value: 'asset', label: '行政資產', labelEn: 'Administrative Asset', description: '非資訊設備、領用與盤點事項' },
    ],
  },
  {
    slug: 'hr',
    navKey: 'nav.departments.hr',
    title: '人事專區',
    titleEn: 'Human Resources Office',
    description: '管理招募、到職、培訓與人員發展事項。',
    descriptionEn: 'Recruitment, onboarding, training and people development.',
    focus: '人才生命週期與組織發展',
    icon: UsersRound,
    accent: 'text-pink-700 dark:text-pink-300',
    accentSoft: 'bg-pink-50 dark:bg-pink-900/20',
    itemTypes: [
      { value: 'recruitment', label: '招募需求', labelEn: 'Recruitment', description: '職缺、面試、錄用與招募進度' },
      { value: 'onboarding', label: '到職作業', labelEn: 'Onboarding', description: '新進人員報到與試用期追蹤' },
      { value: 'training', label: '培訓發展', labelEn: 'Training', description: '年度訓練、職能與學習成果' },
      { value: 'people_action', label: '人員事項', labelEn: 'People Action', description: '調動、晉升、績效與組織異動' },
      { value: 'personnel', label: '人員資料管理', labelEn: 'Personnel Data', description: '員工名冊、聯絡方式與組織架構', linkTo: '/cortex/hr/personnel' },
      { value: 'attendance', label: '出缺勤管理', labelEn: 'Attendance', description: '打卡、假單簽核與出勤異常', linkTo: '/cortex/hr/attendance' },
      { value: 'payroll', label: '薪資管理', labelEn: 'Payroll', description: '薪資結算、獎金與扣繳紀錄', linkTo: '/cortex/hr/payroll' },
    ],
  },
  {
    slug: 'procurement',
    navKey: 'nav.departments.procurement',
    title: '採購專區',
    titleEn: 'Procurement Office',
    description: '管理採購申請、供應商、合約與詢比議價。',
    descriptionEn: 'Purchase requests, suppliers, contracts and quotations.',
    focus: '供應商與採購週期治理',
    icon: ShoppingCart,
    accent: 'text-amber-700 dark:text-amber-300',
    accentSoft: 'bg-amber-50 dark:bg-amber-900/20',
    supportsAmount: true,
    itemTypes: [
      { value: 'purchase_request', label: '採購申請', labelEn: 'Purchase Request', description: '需求、規格、預算與核准流程' },
      { value: 'supplier', label: '供應商管理', labelEn: 'Supplier', description: '供應商評鑑、資格與改善事項' },
      { value: 'contract', label: '合約管理', labelEn: 'Contract', description: '合約審查、到期、續約與履約風險' },
      { value: 'quotation', label: '詢比議價', labelEn: 'Quotation', description: '報價比較、議價紀錄與決選' },
    ],
  },
  {
    slug: 'mis',
    navKey: 'nav.departments.mis',
    title: 'MIS 維運專區',
    titleEn: 'MIS Operations Office',
    description: '處理資訊服務請求、事件、IT 資產與例行維護。',
    descriptionEn: 'IT service requests, incidents, assets and maintenance.',
    focus: '資訊服務與穩定營運',
    icon: MonitorCog,
    accent: 'text-cyan-700 dark:text-cyan-300',
    accentSoft: 'bg-cyan-50 dark:bg-cyan-900/20',
    itemTypes: [
      { value: 'service_request', label: '服務請求', labelEn: 'Service Request', description: '帳號、軟體、權限與一般資訊需求' },
      { value: 'incident', label: '資訊事件', labelEn: 'IT Incident', description: '服務中斷、故障與復原追蹤' },
      { value: 'it_asset', label: 'IT 資產', labelEn: 'IT Asset', description: '設備、授權、保固與生命週期管理' },
      { value: 'maintenance', label: '維護作業', labelEn: 'Maintenance', description: '升級、備份、巡檢與變更時程' },
    ],
  },
  {
    slug: 'sales-projects',
    navKey: 'nav.departments.salesProjects',
    title: '業務工作專案',
    titleEn: 'Sales Delivery Projects',
    description: '管理客戶專案、里程碑、交付物與專案風險。',
    descriptionEn: 'Customer projects, milestones, deliverables and project risks.',
    focus: '客戶承諾與專案交付',
    icon: Handshake,
    accent: 'text-lime-700 dark:text-lime-300',
    accentSoft: 'bg-lime-50 dark:bg-lime-900/20',
    supportsAmount: true,
    itemTypes: [
      { value: 'customer_project', label: '客戶專案', labelEn: 'Customer Project', description: '專案目標、範圍、預算與責任分工' },
      { value: 'milestone', label: '里程碑', labelEn: 'Milestone', description: '重要階段、驗收點與預定日期' },
      { value: 'deliverable', label: '交付物', labelEn: 'Deliverable', description: '文件、產品、服務與客戶驗收' },
      { value: 'project_risk', label: '專案風險', labelEn: 'Project Risk', description: '時程、成本、範圍與客戶溝通風險' },
    ],
  },
  {
    slug: 'it-projects',
    navKey: 'nav.departments.itProjects',
    title: '資訊專案',
    titleEn: 'Information Technology Projects',
    description: '規劃資訊專案、Sprint、部署與專案風險。',
    descriptionEn: 'IT projects, sprints, deployments and delivery risks.',
    focus: '數位建設與敏捷交付',
    icon: ClipboardList,
    accent: 'text-indigo-700 dark:text-indigo-300',
    accentSoft: 'bg-indigo-50 dark:bg-indigo-900/20',
    itemTypes: [
      { value: 'it_project', label: '資訊專案', labelEn: 'IT Project', description: '專案章程、範圍、資源與整體進度' },
      { value: 'sprint', label: 'Sprint', labelEn: 'Sprint', description: '迭代目標、工作範圍與完成情形' },
      { value: 'deployment', label: '部署上線', labelEn: 'Deployment', description: '版本、變更、上線與回復計畫' },
      { value: 'project_risk', label: '專案風險', labelEn: 'Project Risk', description: '依賴、技術、時程與資源風險' },
    ],
  },
  {
    slug: 'information-security',
    navKey: 'nav.departments.informationSecurity',
    title: '資訊安全專區',
    titleEn: 'Information Security Office',
    description: '追蹤資安事件、弱點、合規與資訊安全風險。',
    descriptionEn: 'Security incidents, vulnerabilities, compliance and information risks.',
    focus: '資安治理與風險降低',
    icon: ShieldCheck,
    accent: 'text-red-700 dark:text-red-300',
    accentSoft: 'bg-red-50 dark:bg-red-900/20',
    itemTypes: [
      { value: 'security_incident', label: '資安事件', labelEn: 'Security Incident', description: '偵測、應變、復原與事後改善' },
      { value: 'vulnerability', label: '弱點管理', labelEn: 'Vulnerability', description: '弱點分級、修補期限與例外處理' },
      { value: 'compliance', label: '合規稽核', labelEn: 'Compliance', description: 'ISO、法規、控制措施與稽核改善' },
      { value: 'security_risk', label: '資安風險', labelEn: 'Security Risk', description: '風險評鑑、處理計畫與剩餘風險' },
    ],
  },
];

export const departmentConfigBySlug = Object.fromEntries(
  departmentConfigs.map((department) => [department.slug, department]),
) as Record<DepartmentSlug, DepartmentConfig>;

