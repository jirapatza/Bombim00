import React from 'react';
import { Volume2, VolumeX, RefreshCw } from 'lucide-react';

interface Props {
  currentTimeString: string;
  isVoiceEnabled: boolean;
  isRefreshing: boolean;
  onToggleVoice: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<Props> = ({
  currentTimeString,
  isVoiceEnabled,
  isRefreshing,
  onToggleVoice,
  onRefresh,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-900 bg-slate-950/90 backdrop-blur-md px-4 py-3">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-tight text-slate-100">Lottery Alert</h1>
            <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] font-black text-slate-950">
              PRO
            </span>
          </div>
          {currentTimeString && (
            <p className="text-[11px] font-medium text-amber-400">
              🇹🇭 {currentTimeString} น. (เวลาไทย)
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Voice Toggle */}
          <button
            onClick={onToggleVoice}
            data-testid="top_voice_toggle"
            title={isVoiceEnabled ? 'ปิดเสียงอ่านผล' : 'เปิดเสียงอ่านผล'}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 hover:bg-slate-900 transition-colors"
          >
            {isVoiceEnabled ? (
              <Volume2 className="h-5 w-5 text-amber-400" />
            ) : (
              <VolumeX className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            data-testid="top_refresh_button"
            title="รีเฟรชข้อมูล"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-100 hover:bg-slate-900 transition-colors"
          >
            <RefreshCw
              className={`h-5 w-5 text-slate-100 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`}
            />
          </button>
        </div>
      </div>
    </header>
  );
};
