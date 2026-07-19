import { useState, useEffect } from 'react';
import { Megaphone } from 'lucide-react';

const MOCK_NEWS = [
  '系統公告：本週五晚間 10 點進行例行性維護',
  '新功能：個人化專區已全面上線',
  '資安提醒：請勿點擊來路不明的釣魚郵件',
];

export default function TopNewsTicker() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MOCK_NEWS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden md:flex items-center gap-2 bg-gray-100 dark:bg-gray-700/50 px-4 py-1.5 rounded-full w-64 lg:w-80 overflow-hidden text-sm relative group cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
      <Megaphone className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
      <div className="relative h-5 flex-1 overflow-hidden">
        {MOCK_NEWS.map((news, idx) => {
          const isActive = idx === currentIndex;
          const isPrev = idx === (currentIndex - 1 + MOCK_NEWS.length) % MOCK_NEWS.length;
          
          let translateClass = 'translate-y-full opacity-0';
          if (isActive) translateClass = 'translate-y-0 opacity-100';
          else if (isPrev) translateClass = '-translate-y-full opacity-0';

          return (
            <div
              key={idx}
              className={`absolute top-0 left-0 w-full truncate transition-all duration-500 ease-in-out text-gray-600 dark:text-gray-300 font-medium ${translateClass}`}
            >
              {news}
            </div>
          );
        })}
      </div>
    </div>
  );
}
