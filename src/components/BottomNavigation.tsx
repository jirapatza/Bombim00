import React from 'react';
import { Layers, History, TableProperties, Search, Settings } from 'lucide-react';

export type AppTab = 'live' | 'history' | 'summary' | 'checker' | 'settings';

interface Props {
  currentTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

export const BottomNavigation: React.FC<Props> = ({ currentTab, onChangeTab }) => {
  const tabs = [
    { id: 'live' as AppTab, title: 'หน้าหลัก', icon: Layers, tag: 'nav_live' },
    { id: 'history' as AppTab, title: 'ผลย้อนหลัง', icon: History, tag: 'nav_history' },
    { id: 'summary' as AppTab, title: 'ตารางสรุป', icon: TableProperties, tag: 'nav_summary' },
    { id: 'checker' as AppTab, title: 'ตรวจรางวัล', icon: Search, tag: 'nav_checker' },
    { id: 'settings' as AppTab, title: 'ตั้งค่า', icon: Settings, tag: 'nav_settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-900/95 backdrop-blur-md pb-safe">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const isSelected = currentTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              data-testid={tab.tag}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
                isSelected
                  ? 'text-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div
                className={`flex h-7 w-12 items-center justify-center rounded-full transition-all ${
                  isSelected ? 'bg-amber-500 text-slate-950 shadow-sm' : ''
                }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-slate-950' : 'text-slate-400'}`} />
              </div>
              <span
                className={`mt-0.5 text-[11px] ${
                  isSelected ? 'font-bold text-amber-400' : 'font-normal text-slate-400'
                }`}
              >
                {tab.title}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
