import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Brain, Zap, AlertTriangle, TrendingDown, Sun, Eye,
  Activity, CheckCircle2, ChevronRight, Target, Clock,
  Cpu, Lightbulb, RefreshCw, Send, Thermometer, Battery,
  BarChart2, Wifi, ShieldAlert, Sparkles, Bot, User,
  ArrowUpRight, ArrowDownRight, TriangleAlert, Info,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RChartTip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { useEnergy } from '../context/EnergyContext'
import { useCurrency } from '../context/CurrencyContext'
import {
  predictLoad, predictNextHours, generateRecommendations,
  detectAnomalies, detectSpikes, calcEnergyScore,
} from '../utils/aiEngine'
import { generateDailyData } from '../utils/mockData'
import clsx from 'clsx'

// ─── constants ────────────────────────────────────────────────────────────────
const SEV_COLOR = { critical: '#DB2777', warning: '#EA580C', info: '#0284C7', success: '#059669' }
const SEV_BG    = { critical: 'rgba(219,39,119,0.12)', warning: 'rgba(234,88,12,0.12)', info: 'rgba(2,132,199,0.10)', success: 'rgba(5,150,105,0.10)' }
const CAT_ICON  = { hvac: Thermometer, lighting: Sun, shift: Clock, deferral: Battery, load: Zap, co2: ShieldAlert, temp: Thermometer }

// ─── Canned chat responses ────────────────────────────────────────────────────
const CHAT_RULES = [
  { match: /hvac|air.con|ac\b|cool/i,      reply: (bs) => `HVAC systems across campus are drawing **${bs.reduce((s,b)=>s+(b.hvacLoad??0),0)} kW** total. The biggest consumers are ${bs.sort((a,b)=>(b.hvacLoad??0)-(a.hvacLoad??0)).slice(0,2).map(b=>b.shortName??b.name).join(' and ')}. I recommend a 2°F setback in high-load zones — saves ~12% with no comfort impact.` },
  { match: /peak|spike|high.load/i,        reply: (bs) => { const top = [...bs].sort((a,b)=>b.currentLoad/b.capacity - a.currentLoad/a.capacity)[0]; return `The highest-loaded building right now is **${top.name}** at **${Math.round(top.currentLoad/top.capacity*100)}%** capacity (${top.currentLoad} kW). I'd recommend pre-cooling and load deferral before the next peak window.` } },
  { match: /light|dim|lux/i,               reply: () => `Smart dimming opportunities exist in buildings where occupancy < 65% but lighting > 80%. I can auto-schedule a 30% dim cycle for off-hours — estimated campus-wide saving: **47 kW · ₹46,480/week**.` },
  { match: /anomal|unusual|strange|weird/i, reply: (bs) => { const spikes = detectSpikes(bs); return spikes.length ? `I've detected **${spikes.length} anomalies** right now: ${spikes.map(s=>`${s.shortName} (${s.type})`).join(', ')}. Critical items need immediate attention.` : `No significant anomalies detected at this time. All systems operating within expected parameters.` } },
  { match: /predict|forecast|next|future/i, reply: (bs) => { const now = new Date().getHours(); const next = predictLoad(bs[0], (now+2)%24); return `For the next 2 hours, I predict campus load will reach approximately **${bs.reduce((s,b)=>s+predictLoad(b,(now+2)%24).predicted,0).toLocaleString()} kW** (confidence: ${next.confidence}%). Peak is expected around ${String((now+3)%24).padStart(2,'0')}:00.` } },
  { match: /co2|carbon|emission/i,          reply: (bs) => `Current campus CO₂ emissions: **${bs.reduce((s,b)=>s+(b.carbonKg??Math.round(b.currentLoad*0.82)),0).toLocaleString()} kg/hr**. Shifting 20% of grid draw to renewables would cut this by ~${Math.round(bs.reduce((s,b)=>s+(b.carbonKg??0),0)*0.2)} kg/hr.` },
  { match: /sav|money|cost|rupee|inr|\₹/i, reply: () => `Based on current patterns, I've identified **₹${Math.round((Math.random()*200+180)*83).toLocaleString('en-IN')}/day** in actionable savings — primarily from HVAC setbacks, smart lighting, and off-peak load shifting. Apply all recommendations to hit the target.` },
  { match: /efficien|score|rating/i,        reply: (bs) => { const avg = Math.round(bs.reduce((s,b)=>s+calcEnergyScore(b),0)/bs.length); return `Average campus energy efficiency score: **${avg}/100**. Top performer: ${[...bs].sort((a,b)=>calcEnergyScore(b)-calcEnergyScore(a))[0].name}. Lowest: ${[...bs].sort((a,b)=>calcEnergyScore(a)-calcEnergyScore(b))[0].name} — needs immediate optimization.` } },
  { match: /help|what can|commands/i,       reply: () => `You can ask me about:\n• **HVAC** — cooling efficiency & setbacks\n• **Peak load** — spike detection & forecasts\n• **Lighting** — smart dimming schedules\n• **Anomalies** — unusual consumption patterns\n• **Predictions** — 2–6 hour energy forecasts\n• **Savings** — cost optimization opportunities\n• **CO₂** — emissions & carbon tracking\n• **Scores** — building efficiency ratings` },
]

function getAIReply(input, buildings) {
  const rule = CHAT_RULES.find(r => r.match.test(input))
  if (rule) return rule.reply(buildings)
  return `I've analysed your query about "${input.slice(0,40)}". Based on current telemetry, all 6 campus buildings are within monitored parameters. For specific insights, try asking about **HVAC**, **peak load**, **anomalies**, or **predictions**.`
}

// ─── sub-components ───────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5">
      {[0,1,2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-accent-purple/70"
          style={{ animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }}
        />
      ))}
    </div>
  )
}

function ChatBubble({ msg }) {
  const isAI = msg.role === 'ai'
  return (
    <div className={clsx('flex gap-3 animate-fade-in', isAI ? 'items-start' : 'items-start flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
        isAI ? 'bg-accent-purple/15 border border-accent-purple/30' : 'bg-accent-blue/10 border border-accent-blue/20'
      )}>
        {isAI ? <Bot size={13} className="text-accent-purple" /> : <User size={13} className="text-accent-blue" />}
      </div>

      {/* Bubble */}
      <div className={clsx(
        'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed',
        isAI
          ? 'bg-accent-purple/10 border border-accent-purple/15 text-gray-800 rounded-tl-sm'
          : 'bg-accent-blue/10 border border-accent-blue/15 text-gray-800 rounded-tr-sm'
      )}>
        {msg.typing ? <TypingDots /> : (
          <span dangerouslySetInnerHTML={{
            __html: msg.text
              .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#fff">$1</strong>')
              .replace(/\n/g, '<br/>')
          }} />
        )}
        {!msg.typing && (
          <p className="text-[10px] mt-1.5 opacity-40 font-mono">{msg.ts}</p>
        )}
      </div>
    </div>
  )
}

function RecommendationCard({ rec, index }) {
  const [open, setOpen] = useState(false)
  const sevColor = SEV_COLOR[rec.severity] ?? '#6B7280'
  const sevBg    = SEV_BG[rec.severity]   ?? 'rgba(107,114,128,0.10)'
  const Icon     = CAT_ICON[rec.category] ?? Lightbulb

  return (
    <div
      className="rounded-2xl border transition-all duration-200 cursor-pointer"
      style={{ background: sevBg, borderColor: `${sevColor}30` }}
      onClick={() => setOpen(o => !o)}
    >
      <div className="flex items-start gap-3 p-3.5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: `${sevColor}18`, border: `1px solid ${sevColor}35` }}
        >
          <Icon size={15} style={{ color: sevColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-900 text-xs font-semibold leading-snug">{rec.title}</p>
            <span
              className="chip text-xxs flex-shrink-0 font-bold"
              style={{ background: `${sevColor}18`, color: sevColor }}
            >
              {rec.effort}
            </span>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: '#6B7280' }}>
            {rec.building}
          </p>

          {open && (
            <div className="mt-2.5 space-y-2 animate-fade-in">
              <p className="text-gray-700 text-[11px] leading-relaxed">{rec.detail}</p>
              <div className="flex items-center gap-3 flex-wrap text-[11px]">
                <span style={{ color: '#059669' }} className="font-bold">−{rec.savingKw} kW saved</span>
                <span style={{ color: '#EA580C' }} className="font-bold">−{rec.savingPct}% load</span>
                <span style={{ color: '#94A3B8' }}>{rec.confidence}% confidence</span>
              </div>
              <button
                className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-lg border transition-all"
                style={{ color: sevColor, borderColor: `${sevColor}40`, background: `${sevColor}12` }}
                onClick={e => e.stopPropagation()}
              >
                <Zap size={10} />
                Apply Recommendation
              </button>
            </div>
          )}
        </div>
        <ChevronRight
          size={13}
          className={clsx('text-text-dim flex-shrink-0 mt-1 transition-transform', open && 'rotate-90')}
        />
      </div>
    </div>
  )
}

function SpikeRow({ spike }) {
  const color = SEV_COLOR[spike.severity]
  const Icon  = { load: Zap, co2: ShieldAlert, temp: Thermometer }[spike.type] ?? AlertTriangle
  return (
    <div
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 border"
      style={{ background: SEV_BG[spike.severity], borderColor: `${color}30` }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon size={12} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-900 text-xs font-semibold">{spike.shortName}</span>
          <span className="text-[10px] font-mono font-bold" style={{ color }}>{spike.value}</span>
        </div>
        <p className="text-text-dim text-[10px] truncate">{spike.delta}</p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span
          className="chip text-[9px] font-bold"
          style={{ background: `${color}18`, color }}
        >
          {spike.severity.toUpperCase()}
        </span>
        <span className="text-text-dim text-[9px]">{spike.ts}</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AIInsights() {
  const { buildings } = useEnergy()
  const { format } = useCurrency()
  const now         = new Date().getHours()
  const chatRef     = useRef(null)
  const inputRef    = useRef(null)

  // ── Chat state ──────────────────────────────────────────────────────────────
  const SEED_MESSAGES = [
    {
      id: 'seed1', role: 'ai', ts: 'just now',
      text: `Hello! I'm **NeuraAI v3.2**, your campus energy intelligence assistant. I'm currently monitoring **${buildings.length} buildings** in real-time.\n\nI've detected some actionable insights for you — ask me anything about energy, anomalies, or predictions!`,
    },
    {
      id: 'seed2', role: 'ai', ts: '1 min ago',
      text: `⚡ **Heads up:** ${(() => { const top = [...buildings].sort((a,b)=>b.currentLoad/b.capacity - a.currentLoad/a.capacity)[0]; return `**${top.name}** is currently at **${Math.round(top.currentLoad/top.capacity*100)}%** capacity. I recommend immediate HVAC setback to avoid hitting the peak threshold.`})()}`,
    },
  ]

  const [messages,  setMessages]  = useState(SEED_MESSAGES)
  const [input,     setInput]     = useState('')
  const [thinking,  setThinking]  = useState(false)
  const [recFilter, setRecFilter] = useState('all')
  const [activeTab, setActiveTab] = useState('chat') // chat | anomaly

  // ── Derived data ────────────────────────────────────────────────────────────
  const recs   = generateRecommendations(buildings)
  const spikes = detectSpikes(buildings)

  // Next 6-hour forecast for top building
  const topBuilding = [...buildings].sort((a,b)=>b.currentLoad/b.capacity - a.currentLoad/a.capacity)[0]
  const forecastHours = topBuilding ? predictNextHours(topBuilding, 6) : []

  // 24h chart
  const dailyData = generateDailyData().map((d, i) => {
    const pred = predictLoad(topBuilding ?? buildings[0], i)
    return {
      time:      d.time,
      actual:    i <= now ? Math.round(d.consumption * 0.28) : undefined,
      predicted: pred.predicted,
      high:      pred.high,
      low:       pred.low,
    }
  })

  // Scroll chat to bottom whenever messages change
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  // ── Send message ────────────────────────────────────────────────────────────
  const send = useCallback(() => {
    const text = input.trim()
    if (!text || thinking) return
    const userMsg = { id: Date.now(), role: 'user', ts: 'just now', text }
    const typingMsg = { id: 'typing', role: 'ai', ts: '', text: '', typing: true }
    setMessages(m => [...m, userMsg, typingMsg])
    setInput('')
    setThinking(true)

    setTimeout(() => {
      const reply = getAIReply(text, buildings)
      setMessages(m => [
        ...m.filter(x => x.id !== 'typing'),
        { id: Date.now() + 1, role: 'ai', ts: 'just now', text: reply },
      ])
      setThinking(false)
    }, 900 + Math.random() * 600)
  }, [input, thinking, buildings])

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }

  // ── KPI strip ───────────────────────────────────────────────────────────────
  const totalSavingKw  = recs.reduce((s,r)=>s+r.savingKw, 0)
  const criticalSpikes = spikes.filter(s=>s.severity==='critical').length
  const anomalyCount   = buildings.flatMap(b=>detectAnomalies(b)).length
  const avgScore       = Math.round(buildings.reduce((s,b)=>s+calcEnergyScore(b),0)/buildings.length)

  const filteredRecs = recFilter === 'all' ? recs : recs.filter(r => r.category === recFilter)
  const CAT_FILTERS  = ['all','hvac','lighting','shift','deferral']

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-main flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center">
              <Brain size={18} className="text-accent-purple" />
            </div>
            AI Insights Engine
          </h1>
          <p className="text-text-dim text-sm mt-1 ml-12">
            Chat assistant · Anomaly detection · Predictive energy forecasts
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 glass rounded-xl border border-accent-purple/20 text-xs">
          <Cpu size={12} className="text-accent-purple" />
          <span className="text-accent-purple font-semibold">NeuraAI v3.2</span>
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green ml-1" />
          <span className="text-accent-green">Active</span>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Recommendations', value: recs.length,           color: '#7C3AED', icon: Sparkles,      sub: `${recs.filter(r=>r.severity==='critical').length} critical` },
          { label: 'Anomalies Live',  value: anomalyCount,          color: '#DB2777', icon: ShieldAlert,   sub: `${criticalSpikes} spikes detected` },
          { label: 'kW Saveable',     value: `${totalSavingKw} kW`, color: '#059669', icon: TrendingDown,  sub: 'from current load' },
          { label: 'Campus AI Score', value: `${avgScore}/100`,     color: '#0284C7', icon: BarChart2,     sub: avgScore > 70 ? 'Efficient' : 'Needs attention' },
        ].map(({ label, value, color, icon: Icon, sub }) => (
          <div key={label} className="glass rounded-xl border border-base-border p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-text-dim text-xxs">{label}</p>
              <p className="font-bold font-mono text-base leading-tight" style={{ color }}>{value}</p>
              <p className="text-text-dim text-[10px]">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">

        {/* ── LEFT: Chat + Anomalies ────────────────────────── xl:col-5 ─── */}
        <div className="xl:col-span-5 flex flex-col gap-4">

          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden border border-base-border glass w-fit">
            {[
              { key: 'chat',   label: 'AI Chat',   icon: Bot         },
              { key: 'anomaly',label: 'Anomalies', icon: ShieldAlert },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 text-xs font-semibold transition-all',
                  activeTab === key
                    ? 'bg-accent-purple/15 text-accent-purple border-r border-base-border'
                    : 'text-text-dim hover:text-text-main border-r border-base-border last:border-r-0'
                )}
              >
                <Icon size={12} />
                {label}
                {key === 'anomaly' && anomalyCount > 0 && (
                  <span className="bg-accent-pink/20 text-accent-pink text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    {anomalyCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Chat panel */}
          {activeTab === 'chat' && (
            <div
              className="glass rounded-2xl border border-base-border flex flex-col"
              style={{ height: 520 }}
            >
              {/* Chat header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-base-border flex-shrink-0">
                <div className="w-7 h-7 rounded-lg bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center">
                  <Bot size={13} className="text-accent-purple" />
                </div>
                <div>
                  <p className="text-text-main text-xs font-semibold">NeuraAI Assistant</p>
                  <p className="text-[10px] text-accent-green flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green inline-block" />
                    Online · Rule-based engine
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-[10px] text-text-dim">
                  <Wifi size={10} />
                  Live data
                </div>
              </div>

              {/* Messages */}
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
                style={{ scrollBehavior: 'smooth' }}
              >
                {messages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
              </div>

              {/* Quick suggestions */}
              <div className="px-4 py-2 border-t border-base-border flex gap-1.5 overflow-x-auto flex-shrink-0">
                {['Peak load?', 'Show anomalies', 'Lighting savings', 'Predict next 6hrs', 'CO₂ status'].map(q => (
                  <button
                    key={q}
                    onClick={() => { setInput(q); setTimeout(() => { setInput(q) }, 0) }}
                    className="whitespace-nowrap text-[10px] px-2.5 py-1 rounded-lg border border-base-border text-text-dim hover:text-accent-blue hover:border-accent-blue/30 transition-all flex-shrink-0"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="px-3 pb-3 flex-shrink-0">
                <div className="flex gap-2 items-center glass-elevated rounded-xl border border-base-border px-3 py-2">
                  <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Ask about energy, anomalies, predictions…"
                    className="flex-1 bg-transparent text-xs text-gray-900 placeholder-text-dim outline-none"
                  />
                  <button
                    onClick={send}
                    disabled={!input.trim() || thinking}
                    className={clsx(
                      'w-7 h-7 rounded-lg flex items-center justify-center transition-all flex-shrink-0',
                      input.trim() && !thinking
                        ? 'bg-accent-purple/20 border border-accent-purple/40 text-accent-purple hover:bg-accent-purple/30'
                        : 'bg-black/5 border border-base-border text-text-dim cursor-not-allowed'
                    )}
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Anomaly panel */}
          {activeTab === 'anomaly' && (
            <div
              className="glass rounded-2xl border border-base-border flex flex-col"
              style={{ height: 520 }}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-base-border flex-shrink-0">
                <div>
                  <h3 className="text-gray-900 text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert size={14} className="text-accent-pink" />
                    Live Anomaly Detection
                  </h3>
                  <p className="text-text-dim text-xxs mt-0.5">Spike & threshold monitoring · updated every 5s</p>
                </div>
                <span
                  className="chip text-xxs font-bold"
                  style={{ background: 'rgba(219,39,119,0.15)', color: '#DB2777' }}
                >
                  {spikes.length} spikes
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
                {spikes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                    <CheckCircle2 size={32} className="text-accent-green opacity-60" />
                    <p className="text-gray-900 text-sm font-medium">All Clear</p>
                    <p className="text-text-dim text-xs">No anomalies detected across campus</p>
                  </div>
                ) : (
                  spikes.map(s => <SpikeRow key={s.id} spike={s} />)
                )}

                {/* Per-building anomaly details */}
                {buildings.map(b => {
                  const anom = detectAnomalies(b)
                  if (!anom.length) return null
                  return (
                    <div key={b.id} className="mt-1">
                      <p className="text-text-dim text-[10px] uppercase tracking-widest mb-1.5 px-1">
                        {b.name}
                      </p>
                      {anom.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-1.5"
                          style={{ background: SEV_BG[a.severity], border: `1px solid ${SEV_COLOR[a.severity]}28` }}
                        >
                          <AlertTriangle size={10} style={{ color: SEV_COLOR[a.severity] }} className="flex-shrink-0" />
                          <span className="text-text-main text-[11px] flex-1">{a.message}</span>
                          <span
                            className="chip text-[9px] font-bold flex-shrink-0"
                            style={{ color: SEV_COLOR[a.severity], background: `${SEV_COLOR[a.severity]}15` }}
                          >
                            {a.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Building AI scores */}
          <div className="glass rounded-2xl border border-base-border p-4">
            <h3 className="text-gray-900 font-semibold text-sm mb-3 flex items-center gap-2">
              <BarChart2 size={13} className="text-accent-blue" />
              Building AI Scores
            </h3>
            <div className="space-y-2.5">
              {[...buildings]
                .sort((a,b) => calcEnergyScore(b) - calcEnergyScore(a))
                .map(b => {
                  const score = calcEnergyScore(b)
                  const color = score > 70 ? '#059669' : score > 50 ? '#EA580C' : '#DB2777'
                  return (
                    <div key={b.id} className="flex items-center gap-3">
                      <span className="text-text-dim text-xxs w-10 font-mono flex-shrink-0">
                        {b.shortName ?? b.id.slice(0,4).toUpperCase()}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${score}%`, background: color, boxShadow: `0 0 6px ${color}30` }}
                        />
                      </div>
                      <span className="text-xxs font-mono font-bold w-8 text-right" style={{ color }}>{score}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: Prediction + Recommendations ─────────── xl:col-7 ─── */}
        <div className="xl:col-span-7 flex flex-col gap-5">

          {/* 24h + 6h ahead prediction chart */}
          <div className="glass rounded-2xl border border-base-border p-5">
            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 className="text-gray-900 font-semibold flex items-center gap-2">
                  <Activity size={14} className="text-accent-blue" />
                  Energy Forecast — Next 6 Hours
                </h3>
                <p className="text-text-dim text-xs mt-0.5">
                  {topBuilding?.name ?? 'Campus'} · Actual vs AI-predicted · Confidence band
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                {[
                  { color: '#0284C7', label: 'Actual' },
                  { color: '#7C3AED', label: 'Predicted', dashed: true },
                  { color: '#94A3B8', label: 'Band', opacity: 0.4 },
                ].map(({ color, label, dashed }) => (
                  <span key={label} className="flex items-center gap-1.5 text-text-dim">
                    <svg width="18" height="4">
                      {dashed
                        ? <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="1.5" strokeDasharray="4 2"/>
                        : <line x1="0" y1="2" x2="18" y2="2" stroke={color} strokeWidth="2"/>}
                    </svg>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0284C7" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#0284C7" stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 6" vertical={false} stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="time" tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fill:'#94A3B8', fontSize:10 }} axisLine={false} tickLine={false} />
                <RChartTip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="glass-elevated rounded-xl px-3 py-2 border border-base-border text-xs space-y-1">
                        <p className="text-text-dim font-mono">{label}</p>
                        {payload.map(p => p.value != null && (
                          <div key={p.dataKey} className="flex justify-between gap-4">
                            <span style={{ color: p.color }}>{p.name}</span>
                            <span className="text-gray-900 font-bold">{p.value} kW</span>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                <ReferenceLine
                  x={dailyData[now]?.time}
                  stroke="#EA580C"
                  strokeDasharray="4 3"
                  label={{ value: 'Now', fill: '#EA580C', fontSize: 10, dy: -6 }}
                />
                <Area type="monotone" dataKey="high"      name="Upper"     stroke="none"    fill="url(#gBand)"   connectNulls />
                <Area type="monotone" dataKey="low"       name="Lower"     stroke="none"    fill="#F8FAFC"        connectNulls />
                <Area type="monotone" dataKey="actual"    name="Actual"    stroke="#0284C7" strokeWidth={2}   fill="url(#gActual)" dot={false} connectNulls />
                <Area type="monotone" dataKey="predicted" name="Predicted" stroke="#7C3AED" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} connectNulls />
              </AreaChart>
            </ResponsiveContainer>

            {/* Next 6h mini forecast tiles */}
            <div className="mt-4 grid grid-cols-6 gap-1.5">
              {forecastHours.map((fh, i) => {
                const pct   = fh.predicted / (topBuilding?.capacity ?? 900)
                const color = pct > 0.8 ? '#DB2777' : pct > 0.6 ? '#EA580C' : '#059669'
                return (
                  <div
                    key={i}
                    className="rounded-xl p-2 text-center border"
                    style={{ background: `${color}0d`, borderColor: `${color}28` }}
                  >
                    <p className="text-[10px] font-mono text-text-dim">{fh.label}</p>
                    <p className="text-xs font-bold font-mono mt-0.5" style={{ color }}>{fh.predicted}</p>
                    <p className="text-[9px] text-text-dim">kW</p>
                    <p className="text-[9px] mt-0.5" style={{ color }}>{Math.round(pct*100)}%</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recommendations */}
          <div className="glass rounded-2xl border border-base-border p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-gray-900 font-semibold flex items-center gap-2 text-sm">
                <Lightbulb size={14} className="text-accent-green" />
                Smart Recommendations
                <span className="chip text-xxs bg-accent-green/10 text-accent-green border border-accent-green/20">{recs.length}</span>
              </h3>
              {/* Category filter */}
              <div className="flex gap-1.5 flex-wrap">
                {CAT_FILTERS.map(c => (
                  <button
                    key={c}
                    onClick={() => setRecFilter(c)}
                    className={clsx(
                      'px-2.5 py-1 rounded-lg text-[10px] font-medium border capitalize transition-all',
                      recFilter === c
                        ? 'bg-accent-green/15 text-accent-green border-accent-green/30'
                        : 'border-base-border text-text-dim hover:text-text-main'
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
              {filteredRecs.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 size={24} className="text-accent-green mx-auto mb-2 opacity-60" />
                  <p className="text-text-dim text-xs">No recommendations in this category</p>
                </div>
              ) : (
                filteredRecs.map((rec, i) => <RecommendationCard key={rec.id} rec={rec} index={i} />)
              )}
            </div>

            {/* Savings summary footer */}
            <div className="mt-3 pt-3 border-t border-base-border flex items-center justify-between text-xs">
              <span className="text-text-dim">Apply all recommendations to save</span>
              <div className="flex items-center gap-3">
                <span className="text-accent-green font-bold font-mono">−{totalSavingKw} kW</span>
                <span className="text-accent-orange font-bold font-mono">
                  {format(recs.reduce((s,r)=>s+Math.round(r.savingKw*8.5*8),0))}/day
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
