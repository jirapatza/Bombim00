import React, { useState } from 'react';
import {
  Share2,
  Send,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  MessageSquare,
  Bot,
  Globe,
  Smartphone,
  Eye,
  Sliders,
  Sparkles,
  Zap
} from 'lucide-react';

interface MultiChannelProps {
  settings: any;
  onSaveSettings: (newSettings: any) => void;
  latestDraw: any;
  allLotteries?: any[];
}

export const MultiChannelDispatcher: React.FC<MultiChannelProps> = ({
  settings,
  onSaveSettings,
  latestDraw,
  allLotteries = [],
}) => {
  const [activeChannel, setActiveChannel] = useState<'ntfy' | 'discord' | 'telegram' | 'line' | 'webhook'>('discord');
  const [testStatus, setTestStatus] = useState<{ [key: string]: { loading: boolean; success?: boolean; message?: string } }>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const sampleLottery = allLotteries.find((item) => item.category !== 'gov_savings') || allLotteries[0];
  const sampleLotteryName = sampleLottery?.name || latestDraw?.ชื่อหวย || 'ตัวอย่างหวย';
  const sampleTop3 = sampleLottery?.top3 || (sampleLottery?.firstPrize ? String(sampleLottery.firstPrize).slice(-3) : '') ||
    (latestDraw?.รางวัลที่_1 ? String(latestDraw.รางวัลที่_1).slice(-3) : '-') || '-';
  const sampleBottom2 = sampleLottery?.bottom2 || latestDraw?.เลขท้าย_2_ตัว || '-';
  const sampleDrawDate = sampleLottery?.date || latestDraw?.งวดวันที่ || 'ตัวอย่างสำหรับทดสอบ';
  const sampleTestMessage = `ข้อความทดสอบเท่านั้น (ไม่ใช่ผลหวยจริง)\nหวย: ${sampleLotteryName}\n3 ตัวบน: ${sampleTop3}\n2 ตัวล่าง: ${sampleBottom2}\nตรวจสอบการได้รับบนอุปกรณ์ด้วยตนเอง`;

  // Local draft channel states
  const channels = settings.channels || {};
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(channels.discord?.webhook_url || '');
  const [telegramBotToken, setTelegramBotToken] = useState(channels.telegram?.bot_token || '');
  const [telegramChatId, setTelegramChatId] = useState(channels.telegram?.chat_id || '');
  const [ntfyTopic, setNtfyTopic] = useState(channels.ntfy?.topic || settings.ntfy?.topic || 'lottery-alert-live');
  const [webhookUrl, setWebhookUrl] = useState(channels.webhook?.url || '');
  const [webhookSecret, setWebhookSecret] = useState(channels.webhook?.secret_token || '');

  const copyText = (txt: string, key: string) => {
    navigator.clipboard.writeText(txt);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestChannel = async (channel: 'discord' | 'telegram' | 'webhook' | 'ntfy') => {
    setTestStatus((prev) => ({ ...prev, [channel]: { loading: true } }));

    if (channel === 'ntfy') {
      try {
        const res = await fetch('/api/test-ntfy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: ntfyTopic,
            server: settings.channels?.ntfy?.server || settings.ntfy?.server || 'https://ntfy.sh',
            title: `ทดสอบแจ้งเตือน ${sampleLotteryName} งวด ${sampleDrawDate}`,
            message: sampleTestMessage,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setTestStatus((prev) => ({
            ...prev,
            [channel]: { loading: false, success: true, message: data.message || 'ส่งทดสอบสำเร็จ!' },
          }));
        } else {
          setTestStatus((prev) => ({
            ...prev,
            [channel]: { loading: false, success: false, message: data.error || 'เกิดข้อผิดพลาดในการส่ง' },
          }));
        }
      } catch (err: any) {
        setTestStatus((prev) => ({
          ...prev,
          [channel]: { loading: false, success: false, message: err.message },
        }));
      }
      return;
    }

    try {
      const configPayload: any = {};
      if (channel === 'discord') {
        configPayload.webhook_url = discordWebhookUrl;
      } else if (channel === 'telegram') {
        configPayload.bot_token = telegramBotToken;
        configPayload.chat_id = telegramChatId;
      } else if (channel === 'webhook') {
        configPayload.url = webhookUrl;
        configPayload.secret_token = webhookSecret;
      }

      const res = await fetch('/api/test-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          config: configPayload,
          message: sampleTestMessage,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus((prev) => ({
          ...prev,
          [channel]: { loading: false, success: true, message: data.message },
        }));
      } else {
        setTestStatus((prev) => ({
          ...prev,
          [channel]: { loading: false, success: false, message: data.error || 'ส่งไม่สำเร็จ' },
        }));
      }
    } catch (err: any) {
      setTestStatus((prev) => ({
        ...prev,
        [channel]: { loading: false, success: false, message: err.message },
      }));
    }
  };

  const saveChannelConfig = () => {
    const updated = {
      ...settings,
      channels: {
        ...channels,
        discord: {
          enabled: Boolean(discordWebhookUrl),
          webhook_url: discordWebhookUrl,
          username: 'Lottery Alert Bot',
        },
        telegram: {
          enabled: Boolean(telegramBotToken && telegramChatId),
          bot_token: telegramBotToken,
          chat_id: telegramChatId,
        },
        ntfy: {
          enabled: Boolean(ntfyTopic),
          server: 'https://ntfy.sh',
          topic: ntfyTopic,
          priority: 'high',
        },
        webhook: {
          enabled: Boolean(webhookUrl),
          url: webhookUrl,
          secret_token: webhookSecret,
        },
      },
    };
    onSaveSettings(updated);
  };

  // LINE Flex Message JSON representation
  const lineFlexJson = JSON.stringify(
    {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#111827',
        contents: [
          {
            type: 'text',
            text: `📢 ผล${sampleLotteryName}`,
            weight: 'bold',
            color: '#fbbf24',
            size: 'md',
          },
          {
            type: 'text',
            text: `งวดวันที่ ${sampleDrawDate}`,
            color: '#9ca3af',
            size: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#1f2937',
            cornerRadius: 'md',
            paddingAll: 'md',
            contents: [
              { type: 'text', text: '3 ตัวบน (ตัวอย่าง)', size: 'xxs', color: '#f59e0b', weight: 'bold' },
              { type: 'text', text: sampleTop3, size: 'xxl', weight: 'bold', color: '#fef08a' },
            ],
          },
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#064e3b',
            cornerRadius: 'md',
            paddingAll: 'md',
            contents: [
              { type: 'text', text: '2 ตัวล่าง (ตัวอย่าง)', size: 'xxs', color: '#34d399', weight: 'bold' },
              { type: 'text', text: sampleBottom2, size: 'xxl', weight: 'bold', color: '#6ee7b7' },
            ],
          },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#d97706',
            action: { type: 'uri', label: 'ตรวจผลรางวัลเพิ่มเติม', uri: 'https://news.sanook.com/lotto/' },
          },
        ],
      },
    },
    null,
    2
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Share2 className="w-6 h-6 text-amber-400" />
            ศูนย์รวมช่องทางส่งผลรางวัลพร้อมกัน (Multi-Channel Dispatcher Hub)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ยิงแจ้งเตือนทันทีเข้า Discord Server, Telegram Channel/Group, LINE Flex Message, ntfy บนมือถือ และ Custom API
          </p>
        </div>

        <button
          type="button"
          onClick={saveChannelConfig}
          className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 transition"
        >
          <CheckCircle2 className="w-4 h-4" />
          บันทึกการตั้งค่าช่องทาง
        </button>
      </div>

      {/* Channel Tabs */}
      <div className="flex space-x-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveChannel('discord')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeChannel === 'discord'
              ? 'bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/25'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          Discord Webhook
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('telegram')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeChannel === 'telegram'
              ? 'bg-[#229ED9] text-white shadow-lg shadow-[#229ED9]/25'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Bot className="w-4 h-4" />
          Telegram Bot
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('line')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeChannel === 'line'
              ? 'bg-[#06C755] text-white shadow-lg shadow-[#06C755]/25'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          LINE Flex Message
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('ntfy')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeChannel === 'ntfy'
              ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/25'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Zap className="w-4 h-4" />
          ntfy.sh (มือถือฟรี)
        </button>

        <button
          type="button"
          onClick={() => setActiveChannel('webhook')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
            activeChannel === 'webhook'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
              : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          Custom Webhook (REST POST)
        </button>
      </div>

      {/* Channel Content Panels */}
      {/* 1. DISCORD */}
      {activeChannel === 'discord' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <MessageSquare className="w-5 h-5 text-[#5865F2]" />
              ตั้งค่า Discord Webhook
            </div>
            <p className="text-xs text-slate-400">
              สร้าง Webhook ใน Discord Channel (Settings &gt; Integrations &gt; Webhooks) แล้วนำ URL มาวางที่นี่
            </p>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Discord Webhook URL
              </label>
              <input
                type="url"
                value={discordWebhookUrl}
                onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/123456789/xxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-[#5865F2]"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleTestChannel('discord')}
                disabled={testStatus.discord?.loading || !discordWebhookUrl}
                className="px-4 py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {testStatus.discord?.loading ? 'กำลังส่ง...' : 'ทดสอบส่งการ์ดเข้า Discord'}
              </button>

              {testStatus.discord?.message && (
                <span
                  className={`text-xs font-semibold ${
                    testStatus.discord.success ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {testStatus.discord.message}
                </span>
              )}
            </div>
          </div>

          {/* Discord Live Preview Card */}
          <div className="bg-[#313338] border border-slate-700 rounded-3xl p-5 text-white space-y-3 shadow-xl">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              ตัวอย่างการแสดงผลใน Discord (Rich Embed Preview)
            </span>
            <div className="border-l-4 border-amber-500 bg-[#2b2d31] p-4 rounded-r-xl space-y-2">
              <div className="text-sm font-bold text-amber-400">
                📢 ผล{sampleLotteryName}
              </div>
              <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-mono">
                งวดวันที่ {sampleDrawDate}
                {'\n\n'}🎯 หวย: {sampleLotteryName}
                {'\n'}🔺 3 ตัวบน: `{sampleTop3}`
                {'\n'}🔻 2 ตัวล่าง: `{sampleBottom2}`
                {'\n'}ข้อความทดสอบเท่านั้น ไม่ใช่ผลหวยจริง
                
              </div>
              <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-700/60">
                Lottery Alert Multi-Channel Dispatcher • วันนี้ เวลา 16:05 น.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TELEGRAM */}
      {activeChannel === 'telegram' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Bot className="w-5 h-5 text-[#229ED9]" />
              ตั้งค่า Telegram Bot
            </div>
            <p className="text-xs text-slate-400">
              สร้างบอทผ่าน @BotFather ใน Telegram นำ Token และ Chat ID (หรือ Channel Username เช่น @my_channel) มากรอก
            </p>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Bot Token
              </label>
              <input
                type="password"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWXyz"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-[#229ED9]"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Chat ID หรือ Channel Name
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="-1001234567890 หรือ @lottery_channel"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-[#229ED9]"
              />
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleTestChannel('telegram')}
                disabled={testStatus.telegram?.loading || !telegramBotToken || !telegramChatId}
                className="px-4 py-2.5 rounded-xl bg-[#229ED9] hover:bg-[#1e8bc0] text-white text-xs font-bold cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                {testStatus.telegram?.loading ? 'กำลังส่ง...' : 'ทดสอบส่งข้อความเข้า Telegram'}
              </button>

              {testStatus.telegram?.message && (
                <span
                  className={`text-xs font-semibold ${
                    testStatus.telegram.success ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {testStatus.telegram.message}
                </span>
              )}
            </div>
          </div>

          {/* Telegram Preview */}
          <div className="bg-[#17212b] border border-slate-700 rounded-3xl p-5 text-white space-y-3 shadow-xl">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              ตัวอย่างข้อความใน Telegram Chat
            </span>
            <div className="bg-[#242f3d] p-4 rounded-2xl space-y-2 max-w-sm">
              <div className="text-sm font-bold text-amber-400">
                📢 ผล{sampleLotteryName}
              </div>
              <div className="text-xs text-slate-300 leading-relaxed font-mono">
                งวดวันที่ {latestDraw?.งวดวันที่ || '16 ตุลาคม 2569'}
                <br /><br />
                🔺 <b>3 ตัวบน:</b> <span className="bg-[#17212b] px-1 py-0.5 rounded text-amber-300">{sampleTop3}</span><br />
                🔻 <b>2 ตัวล่าง:</b> <span className="bg-[#17212b] px-1 py-0.5 rounded text-emerald-300">{sampleBottom2}</span><br />
                
                
                ข้อความทดสอบเท่านั้น ไม่ใช่ผลหวยจริง
              </div>
              <div className="text-[10px] text-slate-400 text-right">16:05 น. ✓✓</div>
            </div>
          </div>
        </div>
      )}

      {/* 3. LINE FLEX MESSAGE */}
      {activeChannel === 'line' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Smartphone className="w-5 h-5 text-[#06C755]" />
              LINE Messaging API - Flex Message Generator
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              สำหรับเจ้าของ LINE Official Account (LINE OA) สามารถนำ JSON Card ด้านล่างไปส่งแบบ Broadcast ผ่าน LINE Bot Designer หรือเรียกผ่าน API Push Message ได้ทันที
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyText(lineFlexJson, 'line_flex')}
                className="px-4 py-2 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedKey === 'line_flex' ? 'คัดลอก JSON แล้ว!' : 'คัดลอก Flex Message JSON'}
              </button>

              <a
                href="https://developers.line.biz/flex-simulator/"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                เปิด LINE Flex Simulator
              </a>
            </div>

            <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[10px] font-mono text-slate-300 max-h-60 overflow-y-auto">
              {lineFlexJson}
            </pre>
          </div>

          {/* Visual LINE Card Mockup */}
          <div className="bg-[#7494c0] p-6 rounded-3xl flex justify-center items-center">
            <div className="w-72 bg-white rounded-2xl overflow-hidden shadow-2xl text-slate-900">
              <div className="bg-[#111827] p-4 text-white">
                <div className="text-sm font-bold text-[#fbbf24]">📢 ผลสลากกินแบ่งรัฐบาล</div>
                <div className="text-[10px] text-slate-400">งวดวันที่ {latestDraw?.งวดวันที่ || '16 ตุลาคม 2569'}</div>
              </div>
              <div className="p-4 space-y-3">
                <div className="bg-slate-900 text-white p-3 rounded-xl">
                  <div className="text-[10px] text-amber-400 font-bold uppercase">รางวัลที่ 1 (6,000,000 บ.)</div>
                  <div className="text-2xl font-black text-yellow-200 font-mono tracking-wider">
                    {sampleTop3}
                  </div>
                </div>
                <div className="bg-emerald-950 text-white p-3 rounded-xl">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase">เลขท้าย 2 ตัว (2,000 บ.)</div>
                  <div className="text-2xl font-black text-emerald-300 font-mono tracking-wider">
                    {sampleBottom2}
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 border-t border-slate-100">
                <div className="w-full py-2 bg-amber-500 text-center font-bold text-xs text-white rounded-lg">
                  ตรวจผลรางวัลเพิ่มเติม
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. NTFY */}
      {activeChannel === 'ntfy' && (
        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Zap className="w-5 h-5 text-amber-400" />
            ส่งแจ้งเตือนด่วนผ่าน ntfy.sh (ฟรี ไม่ต้องใช้ Token)
          </div>
          <p className="text-xs text-slate-400">
            ใช้งานได้ทันทีทั้งบน Android, iOS หรือ Desktop Web โดยไม่ต้องลงทะเบียน แค่ใส่ Topic เดียวกันในแอป ntfy
          </p>

          <div className="max-w-md">
            <label className="text-xs text-slate-300 font-semibold block mb-1">
              ชื่อ Topic (ช่องรับสัญญาณ)
            </label>
            <input
              type="text"
              value={ntfyTopic}
              onChange={(e) => setNtfyTopic(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleTestChannel('ntfy')}
              disabled={testStatus.ntfy?.loading || !ntfyTopic}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {testStatus.ntfy?.loading ? 'กำลังส่ง...' : 'ทดสอบส่ง Push เข้ามือถือผ่าน ntfy'}
            </button>

            {testStatus.ntfy?.message && (
              <span
                className={`text-xs font-semibold ${
                  testStatus.ntfy.success ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {testStatus.ntfy.message}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 5. CUSTOM WEBHOOK */}
      {activeChannel === 'webhook' && (
        <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Globe className="w-5 h-5 text-purple-400" />
            เชื่อมต่อ Custom REST Webhook (ยิงเข้า Server หรือระบบ POS)
          </div>
          <p className="text-xs text-slate-400">
            ระบบจะส่ง HTTP POST พร้อม JSON ผลการออกรางวัลไปยัง URL เซิร์ฟเวอร์ของคุณโดยอัตโนมัติ
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Endpoint URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/v1/lottery-hook"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 font-semibold block mb-1">
                Bearer Secret Token (ไม่บังคับ)
              </label>
              <input
                type="password"
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Secret Auth Token..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleTestChannel('webhook')}
              disabled={testStatus.webhook?.loading || !webhookUrl}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {testStatus.webhook?.loading ? 'กำลังส่ง...' : 'ทดสอบยิง HTTP POST'}
            </button>

            {testStatus.webhook?.message && (
              <span
                className={`text-xs font-semibold ${
                  testStatus.webhook.success ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {testStatus.webhook.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
