import { ClipboardList, Megaphone, User, Clock, Calendar, CheckCircle } from 'lucide-react';

export function MyTasks() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-500"/> 待辦事項</h2>
      </div>
      <div className="space-y-3">
        {[
          { title: "審核系統架構設計文件", type: "需要簽核", date: "2026-07-20" },
          { title: "更新第三季部門目標", type: "處理任務", date: "2026-07-22" },
          { title: "部門聚餐費用核銷簽核", type: "需要簽核", date: "2026-07-25" }
        ].map((item, idx) => (
          <div key={idx} className="flex justify-between items-center p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-gray-300 mt-0.5 cursor-pointer hover:text-green-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
                <p className="text-sm text-gray-500">{item.type}</p>
              </div>
            </div>
            <span className="text-sm text-amber-600 font-medium">到期: {item.date}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PersonalAnnouncements() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="h-5 w-5 text-indigo-500"/> 公告與快訊</h2>
      </div>
      <div className="space-y-3">
        {[
          { title: "2026年度員工健康檢查報名", tag: "公司政策", date: "2026-07-19" },
          { title: "颱風假出勤管理辦法更新", tag: "最新消息", date: "2026-07-18" },
          { title: "福委會中秋禮盒選填", tag: "最新消息", date: "2026-07-15" }
        ].map((item, idx) => (
          <div key={idx} className="flex flex-col gap-1 p-3 border rounded-lg">
            <div className="flex justify-between items-start">
              <p className="font-medium text-gray-900 dark:text-gray-100">{item.title}</p>
              <span className="text-xs text-gray-400">{item.date}</span>
            </div>
            <span className="w-max px-2 py-0.5 text-xs rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {item.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PersonalStatus() {
  return (
    <div className="card space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2"><User className="h-5 w-5 text-indigo-500"/> 個人狀態</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2"><Clock className="h-4 w-4 text-gray-500"/> 打卡紀錄</h3>
          <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <span className="text-gray-600 dark:text-gray-300">今日上班</span>
            <span className="font-mono font-medium text-green-600">08:53:12</span>
          </div>
          <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <span className="text-gray-600 dark:text-gray-300">今日下班</span>
            <span className="font-mono text-gray-400">--:--:--</span>
          </div>
        </div>

        <div className="border rounded-lg p-4 space-y-3">
          <h3 className="font-medium flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-500"/> 差勤概況</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">本月遲到</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">0 次</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">本月請假</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">8 小時</span>
            </div>
            <div className="pt-2 mt-2 border-t flex justify-between text-sm">
              <span className="text-gray-500 font-medium">特休餘額</span>
              <span className="font-medium text-primary-600">14.5 天</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
