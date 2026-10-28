import React, { useState } from 'react';
import {
  Rocket,
  Tv,
  Smartphone,
  MessageSquare,
  GitBranch,
  Server,
  Copy,
  ExternalLink,
  CheckCircle2,
  Terminal,
  Shield,
  Layers,
  Sparkles
} from 'lucide-react';

export const DeploymentPlaybook: React.FC = () => {
  const [activeGuide, setActiveGuide] = useState<'kiosk' | 'mobile' | 'community' | 'github' | 'docker'>('kiosk');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Rocket className="w-6 h-6 text-amber-400" />
            คู่มือการนำไปใช้งานจริง & แนวทางการติดตั้ง (Production Deployment Playbook)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            คำแนะนำขั้นตอนการนำระบบไปใช้งานจริงใน 5 รูปแบบ ทั้งหน้าร้าน, กลุ่มแชท, มือถือส่วนบุคคล, GitHub Actions และ Docker VPS
          </p>
        </div>
      </div>

      {/* Guide Nav Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          type="button"
          onClick={() => setActiveGuide('kiosk')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            activeGuide === 'kiosk'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Tv className="w-5 h-5 mb-2 text-amber-400" />
          <span className="text-xs">1. แผงสลาก & หน้าร้าน (Smart TV Kiosk)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuide('mobile')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            activeGuide === 'mobile'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-5 h-5 mb-2 text-emerald-400" />
          <span className="text-xs">2. แจ้งเตือนมือถือ (ntfy Push App)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuide('community')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            activeGuide === 'community'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-2 text-[#5865F2]" />
          <span className="text-xs">3. กลุ่มคอหวย (Discord & Telegram)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuide('github')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            activeGuide === 'github'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <GitBranch className="w-5 h-5 mb-2 text-purple-400" />
          <span className="text-xs">4. รันฟรี 24 ชม. (GitHub Actions)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveGuide('docker')}
          className={`p-4 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
            activeGuide === 'docker'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold shadow-lg shadow-amber-500/10'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Server className="w-5 h-5 mb-2 text-cyan-400" />
          <span className="text-xs">5. โฮสต์เอง (Docker VPS / Cloud)</span>
        </button>
      </div>

      {/* Guide Content */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
        {/* 1. KIOSK GUIDE */}
        {activeGuide === 'kiosk' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Tv className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  แนวทางที่ 1: ตั้งเป็นจอแสดงผล Live Kiosk หน้าร้านแผงลอตเตอรี่หรือร้านกาแฟ
                </h3>
                <p className="text-xs text-slate-400">
                  เปิดบน iPad, Android Tablet หรือ Smart TV เพื่อดึงดูดลูกค้าและประกาศรางวัลอัตโนมัติ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wider block">
                  ขั้นตอนที่ 1
                </span>
                <h4 className="text-sm font-bold text-white">เปิดแท็บ &quot;จอทีวีถ่ายทอดสด&quot;</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  เข้าไปที่แท็บ <strong>&quot;📺 จอทีวีถ่ายทอดสด (Live Kiosk)&quot;</strong> บนอุปกรณ์ที่ต้องการแสดงผล
                </p>
              </div>

              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wider block">
                  ขั้นตอนที่ 2
                </span>
                <h4 className="text-sm font-bold text-white">กดปุ่มแสดงผลเต็มหน้าจอ (Fullscreen)</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  คลิกไอคอนขยายเต็มจอ (Maximize) ตัวเลขรางวัลที่ 1 และเลขท้าย 2 ตัวจะขยายใหญ่สะใจ มองเห็นชัดจากระยะไกล
                </p>
              </div>

              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-2">
                <span className="text-amber-400 text-xs font-bold uppercase tracking-wider block">
                  ขั้นตอนที่ 3
                </span>
                <h4 className="text-sm font-bold text-white">เปิดเสียงลำโพงหน้าร้าน</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ต่อลำโพงบลูทูธเข้ากับแท็บเล็ต ระบบจะส่งเสียงกริ่งและอ่านออกรางวัลภาษาไทยให้ลูกค้าได้ยินชัดเจน
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. MOBILE APP NTFY GUIDE */}
        {activeGuide === 'mobile' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  แนวทางที่ 2: รับการแจ้งเตือนส่วนบุคคลเข้ามือถือผ่านแอป ntfy (Android & iOS)
                </h3>
                <p className="text-xs text-slate-400">
                  ฟรี 100% ไม่ต้องลงทะเบียน เสียงเตือนดังแม้หน้าจอล็อค ไม่ต้องเปิดเว็บค้างไว้
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-3">
                <h4 className="text-sm font-bold text-slate-200">วิธีติดตั้งบนมือถือของคุณ:</h4>
                <ol className="list-decimal list-inside text-xs text-slate-400 space-y-2 leading-relaxed">
                  <li>
                    ดาวน์โหลดแอป <strong>ntfy</strong> จาก Google Play Store (Android) หรือ Apple App Store (iOS)
                  </li>
                  <li>
                    เปิดแอปแล้วกดปุ่มเครื่องหมายบวก <strong>(+) &quot;Subscribe to topic&quot;</strong>
                  </li>
                  <li>
                    พิมพ์ชื่อ Topic เดียวกับที่ตั้งในระบบ เช่น:{' '}
                    <code className="text-amber-400 bg-slate-900 px-2 py-0.5 rounded font-mono">
                      lottery-alert-thai-2026
                    </code>
                  </li>
                  <li>
                    เสร็จเรียบร้อย! เมื่อกองสลากออกรางวัล มือถือของคุณจะส่งเสียงเตือนพร้อมสั่น และแสดงผลเลขรางวัลบนหน้าจอล็อคทันที
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* 3. COMMUNITY DISCORD & TELEGRAM GUIDE */}
        {activeGuide === 'community' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  แนวทางที่ 3: แจ้งเตือนเข้าห้องแชท Discord Server หรือ Telegram Channel
                </h3>
                <p className="text-xs text-slate-400">
                  สร้างบริการแจ้งเตือนผลหวยอัตโนมัติสำหรับสมาชิกในกลุ่มคอหวย ชุมชน หรือเพจของคุณ
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-[#5865F2]">Discord Server:</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  1. คลิกขวาที่ห้องแชท Discord &gt; Edit Channel &gt; Integrations &gt; Webhooks<br />
                  2. กด &quot;New Webhook&quot; แล้วกดคัดลอก Webhook URL<br />
                  3. นำ URL มาวางในแท็บ <strong>&quot;🌐 รวมช่องทางแจ้งเตือน&quot;</strong> ของระบบนี้<br />
                  4. สมาชิกในดิสคอร์ดจะได้รับการ์ดสีทองสวยงามพร้อมปุ่มตรวจรางวัล
                </p>
              </div>

              <div className="bg-slate-950/70 p-5 rounded-2xl border border-slate-800 space-y-2">
                <h4 className="text-sm font-bold text-[#229ED9]">Telegram Group / Channel:</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  1. ค้นหาบอท <strong>@BotFather</strong> ใน Telegram แล้วพิมพ์คำสั่ง <code className="text-amber-400">/newbot</code><br />
                  2. ได้รับ HTTP API Token ให้นำมาใส่ในระบบ<br />
                  3. ดึงบอทเข้าห้องแชทหรือ Channel แล้วใส่ Chat ID<br />
                  4. บอทจะพิมพ์ประกาศผลให้อัตโนมัติทุกงวด
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4. GITHUB ACTIONS GUIDE */}
        {activeGuide === 'github' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <GitBranch className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  แนวทางที่ 4: รันอัตโนมัติฟรี 100% บน GitHub Actions (Serverless Cron)
                </h3>
                <p className="text-xs text-slate-400">
                  ไม่ต้องเปิดคอมพิวเตอร์ทิ้งไว้ GitHub ให้โควตารันฟรีเดือนละ 2,000 นาที ซึ่งเพียงพอตลอดทั้งปี
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-purple-400 font-bold">
                  .github/workflows/lottery.yml (มีพร้อมอยู่ในโปรเจกต์แล้ว)
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyCode(
                      'name: Lottery Checker\non:\n  schedule:\n    - cron: "*/15 7-10 1,16 * *"\n  workflow_dispatch:',
                      'gh_cron'
                    )
                  }
                  className="px-3 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedCode === 'gh_cron' ? 'คัดลอกแล้ว!' : 'คัดลอก'}
                </button>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                เพียงแค่ Push โปรเจกต์นี้ขึ้น GitHub Repository ของคุณ แล้วไปที่ <strong>Settings &gt; Secrets and variables &gt; Actions</strong> จากนั้นเพิ่ม Secret ชื่อ <code className="text-amber-400 font-bold">NTFY_TOPIC</code> ระบบจะรันอัตโนมัติทุกวันที่ 1 และ 16 เวลา 14:00 - 17:00 น.
              </p>
            </div>
          </div>
        )}

        {/* 5. DOCKER VPS GUIDE */}
        {activeGuide === 'docker' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Server className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  แนวทางที่ 5: ติดตั้งบน Server VPS / Cloud (DigitalOcean, AWS, Synology NAS, Docker)
                </h3>
                <p className="text-xs text-slate-400">
                  รันผ่าน Docker Container คำสั่งเดียว พร้อมทั้ง Dashboard และสคริปต์ตรวจผลในตัว
                </p>
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-cyan-400 font-bold">คำสั่งสั่งรันด้วย Docker Compose:</span>
                <button
                  type="button"
                  onClick={() => copyCode('docker-compose up -d', 'docker_cmd')}
                  className="px-3 py-1 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedCode === 'docker_cmd' ? 'คัดลอกแล้ว!' : 'คัดลอก'}
                </button>
              </div>
              <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300">
                docker-compose up -d
              </pre>
              <p className="text-xs text-slate-400">
                เข้าใช้งานผ่านเว็บเบราว์เซอร์ได้ที่ <code className="text-amber-400">http://IP-ของคุณ:3000</code> ทันที
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
