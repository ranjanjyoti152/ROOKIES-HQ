import { useState, useEffect } from 'react';
import api from '../api/client';
import useAuthStore from '../store/authStore';
import {
  CheckSquare, AlertTriangle, TrendingUp,
  FolderOpen, Users, Eye, Zap, Flame,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

const STAGE_COLORS = {
  unassigned: '#6b7280',
  claimed:    '#f97316',
  editing:    '#eab308',
  revision:   '#a855f7',
  delivered:  '#22c55e',
};

const LEAD_COLORS = {
  new_lead:   '#93ccff',
  follow_ups: '#f97316',
  vfa:        '#a855f7',
  client_won: '#22c55e',
  closed:     '#f87171',
};

const LEAD_LABELS = {
  new_lead:   'New',
  follow_ups: 'Contacted',
  vfa:        'VFA',
  client_won: 'Won',
  closed:     'Lost',
};

// ─── Stat Card ───────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }) {
  const [hover, setHover] = useState(false);
  const ac = accent || '#f97316';
  const IconComponent = icon;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? '#241e1c' : 'rgba(32,26,24,0.6)',
        backdropFilter: 'blur(16px)',
        borderRadius: 14,
        outline: `1px solid ${hover ? 'rgba(249,115,22,0.25)' : 'rgba(88,66,55,0.2)'}`,
        padding: '18px 20px',
        transition: 'all 180ms cubic-bezier(.4,0,.2,1)',
        cursor: 'default',
        boxShadow: hover ? '0 6px 24px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: `${ac}1a`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconComponent size={15} color={ac} strokeWidth={2.2} />
        </div>
        {sub !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: ac, background: `${ac}15`,
            padding: '2px 8px', borderRadius: 999,
          }}>{sub}</span>
        )}
      </div>
      <div style={{ fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.04em', color: '#f5ede8', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(167,139,125,0.55)', marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

// ─── Tasks by Stage (CSS Bar Chart) ──────────────────────
function TasksByStage({ data }) {
  const max = Math.max(...Object.values(data), 1);
  const stages = Object.entries(data);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
      {stages.map(([stage, count]) => (
        <div key={stage}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#e0c0b1', textTransform: 'capitalize' }}>
              {stage.replace('_', ' ')}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: STAGE_COLORS[stage] }}>{count}</span>
          </div>
          <div style={{ height: 8, background: 'rgba(88,66,55,0.18)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(count / max) * 100}%`,
              background: STAGE_COLORS[stage],
              borderRadius: 999,
              transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
              boxShadow: `0 0 8px ${STAGE_COLORS[stage]}55`,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lead Pipeline Donut (SVG) ────────────────────────────
function LeadDonut({ data }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const won  = data.client_won || 0;
  const lost = data.closed || 0;

  const R = 52, cx = 70, cy = 70, stroke = 14;
  const circumference = 2 * Math.PI * R;
  let offset = 0;

  const slices = Object.entries(data).map(([key, val]) => {
    const pct = total > 0 ? val / total : 0;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    const slice = { key, val, offset, dash, gap, color: LEAD_COLORS[key] };
    offset += dash;
    return slice;
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      {/* SVG Donut */}
      <svg width={140} height={140} viewBox="0 0 140 140">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(88,66,55,0.2)" strokeWidth={stroke} />
        ) : slices.map(s => (
          <circle
            key={s.key}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '70px 70px', transition: 'stroke-dasharray 0.8s cubic-bezier(.4,0,.2,1)' }}
          />
        ))}
        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#f5ede8" fontSize={20} fontWeight={800}>{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(167,139,125,0.6)" fontSize={9} fontWeight={700} style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>LEADS</text>
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(167,139,125,0.7)', minWidth: 70 }}>{LEAD_LABELS[s.key]}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.val}</span>
          </div>
        ))}
        {/* Won vs Lost highlight */}
        <div style={{ marginTop: 4, padding: '6px 10px', background: 'rgba(34,197,94,0.08)', borderRadius: 8, border: '1px solid rgba(34,197,94,0.15)' }}>
          <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>
            Won {won} &nbsp;·&nbsp;
          </span>
          <span style={{ fontSize: 10, color: '#f87171', fontWeight: 700 }}>
            Lost {lost}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 7-Day Line Chart (SVG) ───────────────────────────────
function CompletionsChart({ data }) {
  const W = 260, H = 90, PAD = 12;
  const counts = data.map(d => d.count);
  const maxV = Math.max(...counts, 1);
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((d.count / maxV) * (H - PAD * 2));
    return { x, y, ...d };
  });
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
  const area = `${pts[0].x},${H - PAD} ` + polyline + ` ${pts[pts.length - 1].x},${H - PAD}`;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#lineGrad)" />
        <polyline points={polyline} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill="#f97316" stroke="#181210" strokeWidth={1.5} />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {data.map((d, i) => (
          <span key={i} style={{ fontSize: 9, color: 'rgba(88,66,55,0.5)', fontWeight: 600 }}>{d.date.split(' ')[1]}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Team Workload ────────────────────────────────────────
function TeamWorkload({ data }) {
  const maxTasks = Math.max(...data.map(u => u.task_count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.length === 0 && (
        <p style={{ fontSize: 12, color: 'rgba(88,66,55,0.4)', textAlign: 'center', padding: '12px 0' }}>No team data</p>
      )}
      {data.map(u => (
        <div key={u.user_id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(249,115,22,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: '#f97316', flexShrink: 0,
            }}>
              {initials(u.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#ece0dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {u.name}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginLeft: 8, flexShrink: 0 }}>
                  {u.task_count}
                </span>
              </div>
              {u.current_task && (
                <div style={{ fontSize: 10, color: 'rgba(88,66,55,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                  {u.current_task}
                </div>
              )}
            </div>
          </div>
          <div style={{ height: 4, background: 'rgba(88,66,55,0.18)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${(u.task_count / maxTasks) * 100}%`,
              background: 'linear-gradient(90deg, #ffb690, #f97316)',
              borderRadius: 999,
              transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Top Performers ───────────────────────────────────────
const RANK_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

function TopPerformers({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.length === 0 && (
        <p style={{ fontSize: 12, color: 'rgba(88,66,55,0.4)', textAlign: 'center', padding: '12px 0' }}>No leaderboard data yet</p>
      )}
      {data.map((p, i) => (
        <div key={p.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Rank */}
          <div style={{
            width: 22, height: 22, borderRadius: 6,
            background: i < 3 ? `${RANK_COLORS[i]}18` : 'rgba(88,66,55,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800,
            color: i < 3 ? RANK_COLORS[i] : 'rgba(88,66,55,0.5)', flexShrink: 0,
          }}>
            {p.rank}
          </div>
          {/* Avatar */}
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(249,115,22,0.12)',
            border: i === 0 ? '1.5px solid #ffd700' : '1.5px solid rgba(88,66,55,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#f97316', flexShrink: 0,
          }}>
            {initials(p.name)}
          </div>
          {/* Name */}
          <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#ece0dc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </span>
          {/* Points */}
          <span style={{
            fontSize: 11, fontWeight: 800,
            color: i < 3 ? RANK_COLORS[i] : '#a78b7d',
            background: i < 3 ? `${RANK_COLORS[i]}12` : 'rgba(88,66,55,0.1)',
            padding: '2px 8px', borderRadius: 999,
          }}>
            {Math.round(p.points)} pts
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section Card Wrapper ─────────────────────────────────
function SectionCard({ title, children, style }) {
  return (
    <div style={{
      background: 'rgba(32,26,24,0.6)', backdropFilter: 'blur(16px)',
      borderRadius: 14, outline: '1px solid rgba(88,66,55,0.2)',
      padding: '18px 20px', ...style,
    }}>
      {title && (
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(249,115,22,0.6)', marginBottom: 16 }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuthStore();
  const firstName = user?.full_name?.split(' ')[0] || 'Rookie';

  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/charts'),
    ]).then(([sRes, cRes]) => {
      setStats(sRes.data);
      setCharts(cRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const s = stats || {};
  const c = charts || {};

  const STAT_CARDS = [
    { icon: CheckSquare,   label: 'Active Tasks',     value: s.active_tasks     ?? '—', accent: '#f97316' },
    { icon: Zap,           label: 'Completed',         value: s.completed_tasks  ?? '—', accent: '#22c55e' },
    { icon: AlertTriangle, label: 'Overdue',           value: s.overdue_tasks    ?? '—', accent: '#f87171' },
    { icon: TrendingUp,    label: 'Lead Conversion',   value: s.lead_conversion !== undefined ? `${s.lead_conversion}%` : '—', accent: '#93ccff' },
    { icon: FolderOpen,    label: 'Projects',          value: s.active_projects  ?? '—', accent: '#f97316' },
    { icon: Users,         label: 'Team Members',      value: s.team_members     ?? '—', accent: '#a855f7' },
    { icon: Eye,           label: 'Needs Review',      value: s.needs_review     ?? '—', accent: '#eab308' },
    { icon: Flame,         label: 'Completion Rate',   value: s.completion_rate !== undefined ? `${s.completion_rate}%` : '—', accent: '#22c55e' },
  ];

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto', paddingBottom: 24 }}>

      {/* ── Greeting ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#f5ede8', lineHeight: 1.2 }}>
            Hi, <span style={{ color: '#f97316' }}>{firstName}!</span>
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(167,139,125,0.65)', marginTop: 4, fontWeight: 500 }}>
            {s.overdue_tasks > 0
              ? `⚠️ ${s.overdue_tasks} task${s.overdue_tasks > 1 ? 's' : ''} overdue — check the pipeline.`
              : "You're on track — let's push forward! 🚀"}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {s.completion_rate >= 70 && (
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(249,115,22,0.7)', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 999, background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <Flame size={10} style={{ display: 'inline', marginRight: 4 }} />
              Sprint Active
            </span>
          )}
        </div>
      </div>

      {/* ── ROW 1: 8 Stat Cards ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 100, borderRadius: 14 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {STAT_CARDS.map(sc => <StatCard key={sc.label} {...sc} />)}
        </div>
      )}

      {/* ── ROW 2: Tasks by Stage + Lead Donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <SectionCard title="Tasks by Stage">
          {loading
            ? <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />
            : <TasksByStage data={c.tasks_by_stage || {}} />
          }
        </SectionCard>
        <SectionCard title="Lead Pipeline">
          {loading
            ? <div className="skeleton" style={{ height: 160, borderRadius: 8 }} />
            : <LeadDonut data={c.lead_pipeline || {}} />
          }
        </SectionCard>
      </div>

      {/* ── ROW 3: Completions + Workload + Performers ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <SectionCard title="Completions — Last 7 Days">
          {loading
            ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
            : (c.completions_7d?.length > 0
                ? <CompletionsChart data={c.completions_7d} />
                : <p style={{ fontSize: 12, color: 'rgba(88,66,55,0.4)', textAlign: 'center', padding: '20px 0' }}>No deliveries yet</p>
              )
          }
        </SectionCard>
        <SectionCard title="Team Workload">
          {loading
            ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
            : <TeamWorkload data={c.team_workload || []} />
          }
        </SectionCard>
        <SectionCard title="Top Performers">
          {loading
            ? <div className="skeleton" style={{ height: 120, borderRadius: 8 }} />
            : <TopPerformers data={c.top_performers || []} />
          }
        </SectionCard>
      </div>

    </div>
  );
}
