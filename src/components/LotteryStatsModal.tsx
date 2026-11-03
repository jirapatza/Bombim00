import React from 'react';
import {X} from 'lucide-react';
import type {LotteryItem} from './DailySummaryTable';
import {IndividualHistory} from './ResultsOverview';

interface LotteryStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lottery: LotteryItem | null;
  results?: any[];
  onSpeak?: (text: string) => void;
  onOpenImageModal?: (lottery: LotteryItem) => void;
}

export const LotteryStatsModal: React.FC<LotteryStatsModalProps> = ({isOpen,onClose,lottery,results=[]}) => {
 if(!isOpen||!lottery)return null;
 return <div className="fixed inset-0 z-50 bg-slate-950/90 p-2 sm:p-6 flex items-center justify-center">
  <section className="system-tools" role="dialog" aria-modal="true" aria-labelledby="history-modal-title">
   <header><h2 id="history-modal-title">ผลย้อนหลังและสถิติ</h2><button onClick={onClose} aria-label="ปิดผลย้อนหลัง"><X/></button></header>
   <div className="system-tools-body"><IndividualHistory key={lottery.id} lotteries={[lottery]} results={results} initialLotteryId={lottery.id}/></div>
  </section>
 </div>;
};
