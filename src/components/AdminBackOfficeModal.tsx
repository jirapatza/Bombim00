import React, { useState } from 'react';
import { X } from 'lucide-react';
import { SystemMonitorKiosk } from './SystemMonitorKiosk';
import { GitHubAppRunner } from './GitHubAppRunner';

interface AdminBackOfficeModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: any;
  onSaveSettings: (newSettings: any) => Promise<boolean>;
  status: any;
  latestDraw: any;
  allLotteries: any[];
  voiceEnabled: boolean;
  onToggleVoice: (v: boolean) => void;
  onStopSpeech: () => void;
  isSpeaking: boolean;
  onTriggerCheck: () => void;
  isTriggering: boolean;
  onRefreshData: () => void;
  templateProps: any;
}

export const AdminBackOfficeModal: React.FC<AdminBackOfficeModalProps> = ({isOpen,onClose,onRefreshData}) => {
  const [tab,setTab]=useState<'monitor'|'runner'>('monitor');
  if(!isOpen)return null;
  return <div className="fixed inset-0 z-50 bg-slate-950/90 p-2 sm:p-6 flex items-center justify-center">
    <section role="dialog" aria-modal="true" aria-labelledby="system-tools-title" className="system-tools">
      <header><div><h2 id="system-tools-title">สถานะระบบ</h2><p>ตรวจการเชื่อมต่อและประวัติการตรวจผล</p></div><button onClick={onClose} aria-label="ปิดสถานะระบบ"><X/></button></header>
      <nav aria-label="เครื่องมือระบบ"><button aria-pressed={tab==='monitor'} onClick={()=>setTab('monitor')}>สถานะการเชื่อมต่อ</button><button aria-pressed={tab==='runner'} onClick={()=>setTab('runner')}>รอบตรวจผล</button></nav>
      <div className="system-tools-body">{tab==='monitor'?<SystemMonitorKiosk/>:<GitHubAppRunner onRefreshStatus={onRefreshData}/>}</div>
    </section>
  </div>;
};
