import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { ALL_LEVELS, MEGA_LEVEL, NORMAL_LEVELS } from '../utils/huntConfig';
import {
  Search,
  Trophy,
  Users,
  Star,
  Zap,
  MapPin,
  Lock,
  CheckCircle2,
  Activity,
} from 'lucide-react';

/* ─────────────────────────────── helpers ──────────────────────────────── */

const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function useNow(intervalMs = 5000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/* ─────────────────────────── stat card ────────────────────────────────── */

function StatCard({ icon: Icon, label, value, accent, bgAccent, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      className="stat-card"
      style={{ '--accent': accent, '--bg-accent': bgAccent }}
    >
      <div className="stat-icon">
        <Icon size={22} strokeWidth={2.5} />
      </div>
      <div className="stat-body">
        <span className="stat-value">{value}</span>
        <span className="stat-label">{label}</span>
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── level card ───────────────────────────────── */

function LevelCard({ level, claim, playersHere, claimedCount, delay = 0 }) {
  const isMega = level === MEGA_LEVEL;
  const isClaimed = !!claim;
  const megaLocked = isMega && claimedCount < NORMAL_LEVELS;

  let cardClass = 'level-card';
  let statusEl = null;
  let statusLine = null;

  if (isMega) {
    cardClass += megaLocked ? ' level-mega-locked' : ' level-mega-open';
    statusEl = megaLocked ? (
      <div className="level-status-badge badge-locked">
        <Lock size={11} strokeWidth={2.5} /> LOCKED
      </div>
    ) : (
      <div className="level-status-badge badge-mega">
        <Star size={11} strokeWidth={2.5} /> MEGA OPEN
      </div>
    );
    statusLine = megaLocked
      ? `${claimedCount}/${NORMAL_LEVELS} to unlock`
      : claim
      ? `🏆 ${claim.displayName}`
      : 'Up for grabs!';
  } else if (isClaimed) {
    cardClass += ' level-claimed';
    statusEl = (
      <div className="level-status-badge badge-claimed">
        <CheckCircle2 size={11} strokeWidth={2.5} /> CLAIMED
      </div>
    );
    statusLine = claim.displayName || claim.email?.split('@')[0] || 'Winner';
  } else {
    cardClass += ' level-open';
    statusEl = (
      <div className="level-status-badge badge-open">
        <Zap size={11} strokeWidth={2.5} /> OPEN
      </div>
    );
    statusLine = playersHere > 0 ? `${playersHere} hunting` : 'Unclaimed';
  }

  return (
    <motion.div
      className={cardClass}
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay, ease: [0.34, 1.26, 0.64, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.18 } }}
    >
      <div className="level-number-row">
        <span className="level-number">{isMega ? '★' : level}</span>
        {statusEl}
      </div>
      <div className="level-label">{isMega ? 'MEGA' : `Level ${level}`}</div>
      <div className="level-sub">{statusLine}</div>
      {!isMega && !isClaimed && playersHere > 0 && (
        <div className="level-hunters-pip">
          {Array.from({ length: Math.min(playersHere, 4) }).map((_, i) => (
            <span key={i} className="pip" />
          ))}
        </div>
      )}
    </motion.div>
  );
}

/* ─────────────────────────── team row ──────────────────────────── */

function TeamRow({ team, index }) {
  return (
    <motion.div
      key={team.id}
      className="hunter-row"
      initial={{ opacity: 0, x: -28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 28 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <div className="hunter-avatar" style={{ background: index < 3 ? '#4285F4' : '#e5e7eb', color: index < 3 ? 'white' : '#6b7280' }}>
        #{index + 1}
      </div>
      <div className="hunter-info">
        <span className="hunter-name" style={{ fontSize: '1.1rem' }}>{team.name}</span>
        <span className="hunter-level" style={{ color: '#FBBC04', fontWeight: 900 }}>
          {team.score || 0} pts
        </span>
      </div>
    </motion.div>
  );
}

/* ───────────────────────────── main page ──────────────────────────────── */

export default function TreasureHuntPreview() {
  const now = useNow(5000);

  const [players, setPlayers] = useState([]);   // huntPlayers docs
  const [claims, setClaims] = useState({});      // { [level]: doc }
  const [teams, setTeams] = useState([]);        // huntTeams docs
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);               // clock tick for footer

  /* live Firestore subscriptions */
  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, 'huntPlayers'), (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPlayers(arr);
      setLoading(false);
    });

    const unsubClaims = onSnapshot(collection(db, 'huntClaims'), (snap) => {
      const map = {};
      snap.forEach((d) => {
        map[Number(d.data().level ?? d.id)] = d.data();
      });
      setClaims(map);
    });

    const unsubTeams = onSnapshot(collection(db, 'huntTeams'), (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTeams(arr);
    });

    return () => {
      unsubPlayers();
      unsubClaims();
      unsubTeams();
    };
  }, []);

  /* footer clock */
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  /* derived stats */
  const totalPlayers = players.length;

  const activePlayers = useMemo(
    () => players.filter((p) => now - tsToMs(p.lastActive) < ACTIVE_WINDOW_MS),
    [players, now]
  );

  const claimedCount = useMemo(
    () => ALL_LEVELS.filter((l) => l !== MEGA_LEVEL && claims[l]).length,
    [claims]
  );

  const winnersCount = useMemo(
    () => players.filter((p) => (p.currentLevel ?? 0) > MEGA_LEVEL).length,
    [players]
  );

  /* players per level */
  const playersPerLevel = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      const lv = p.currentLevel;
      if (lv) map[lv] = (map[lv] || 0) + 1;
    });
    return map;
  }, [players]);

  /* active hunters sorted by lastActive desc */
  const liveHunters = useMemo(
    () =>
      [...activePlayers].sort((a, b) => tsToMs(b.lastActive) - tsToMs(a.lastActive)).slice(0, 12),
    [activePlayers]
  );

  /* sorted teams */
  const sortedTeams = useMemo(
    () => [...teams].sort((a, b) => (b.score || 0) - (a.score || 0)),
    [teams]
  );

  const timeStr = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <>
      <style>{CSS}</style>
      <div className="thp-root">
        {/* ── Decorative top bar ── */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #4285F4 0%, #EA4335 33%, #FBBC04 66%, #34A853 100%)' }} />

        {/* ═══════════════════ HEADER ═══════════════════ */}
        <motion.header
          className="thp-header"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="header-brand">
            <img src="/gdg_logo.png" alt="GDG SRMCEM" className="header-logo" />
            <div className="header-text">
              <span className="header-org">GDG SRMCEM</span>
              <span className="header-event">Arcade 2026</span>
            </div>
          </div>

          <div className="header-title-wrap">
            <div className="title-icon-wrap"><Search size={20} strokeWidth={2.5} /></div>
            <h1 className="header-title">Mystery Hunt</h1>
            <span className="live-badge">
              <span className="live-dot" />
              LIVE
            </span>
          </div>

          <div className="header-right">
            <div style={{ fontSize: '1.4rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#374151', letterSpacing: '0.02em' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 500, textAlign: 'right' }}>
              {totalPlayers} hunter{totalPlayers !== 1 ? 's' : ''}
            </div>
          </div>
        </motion.header>

        {loading ? (
          <div className="thp-loading">
            <div className="spinner" />
            <span>Connecting to live data…</span>
          </div>
        ) : (
          <main className="thp-main">
            {/* ═══════════════════ STATS BAR ═══════════════════ */}
            <section className="stats-bar">
              <StatCard
                icon={Users}
                label="Registered"
                value={totalPlayers}
                accent="#4285F4"
                bgAccent="#e8f0fe"
                delay={0.05}
              />
              <StatCard
                icon={Activity}
                label="Active (10 min)"
                value={activePlayers.length}
                accent="#34A853"
                bgAccent="#e6f4ea"
                delay={0.1}
              />
              <StatCard
                icon={MapPin}
                label="Levels Claimed"
                value={`${claimedCount} / ${NORMAL_LEVELS}`}
                accent="#FBBC04"
                bgAccent="#fef3cd"
                delay={0.15}
              />
              <StatCard
                icon={Trophy}
                label="Winners"
                value={winnersCount}
                accent="#EA4335"
                bgAccent="#fce8e6"
                delay={0.2}
              />
            </section>

            {/* ═══════════════════ LEVEL GRID ═══════════════════ */}
            <section className="levels-section">
              <div className="section-heading">
                <Search size={15} strokeWidth={2.5} />
                <span>Hunt Board</span>
                <div className="heading-line" />
              </div>

              <div className="levels-grid">
                {ALL_LEVELS.map((level, i) => (
                  <LevelCard
                    key={level}
                    level={level}
                    claim={claims[level]}
                    playersHere={playersPerLevel[level] || 0}
                    claimedCount={claimedCount}
                    delay={0.05 + i * 0.04}
                  />
                ))}
              </div>

              {/* mega progress bar */}
              <div className="mega-progress-wrap">
                <div className="mega-progress-label">
                  <Star size={14} strokeWidth={2.5} />
                  <span>
                    Mega Level unlocks when all {NORMAL_LEVELS} normal levels are claimed —{' '}
                    <strong>{claimedCount}/{NORMAL_LEVELS}</strong> claimed
                  </span>
                </div>
                <div className="mega-progress-track">
                  <motion.div
                    className="mega-progress-fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${(claimedCount / NORMAL_LEVELS) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </section>

            {/* ═══════════════════ LIVE HUNTERS ═══════════════════ */}
            <section className="hunters-section">
              <div className="section-heading">
                <Trophy size={15} strokeWidth={2.5} />
                <span>Team Leaderboard</span>
                <span className="hunters-count-badge">{teams.length} teams</span>
                <div className="heading-line" />
              </div>

              <div className="hunters-feed">
                <AnimatePresence>
                  {sortedTeams.length === 0 ? (
                    <motion.p
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hunters-empty"
                    >
                      No teams registered yet.
                    </motion.p>
                  ) : (
                    sortedTeams.map((team, i) => (
                      <TeamRow key={team.id} team={team} index={i} />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </section>
          </main>
        )}

        {/* ═══════════════════ FOOTER ═══════════════════ */}
        <footer className="thp-footer">
          <div className="footer-left">
            <span className="footer-live-dot" />
            <span className="footer-text">Live via Firestore</span>
          </div>

          <div className="footer-right">
            <div className="footer-dots">
              {['#4285F4','#EA4335','#FBBC04','#34A853'].map((c, i) => (
                <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
              ))}
            </div>
            <span className="footer-brand">GDG SRMCEM · Arcade 2026</span>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ═══════════════════════════════ CSS ═══════════════════════════════════ */

const CSS = `
  /* ── reset / root ── */
  .thp-root {
    min-height: 100vh;
    width: 100%;
    background: #ffffff;
    color: #111;
    font-family: 'Google Sans', 'Segoe UI', system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
    position: relative;
  }

  /* ── header ── */
  .thp-header {
    background: #fff;
    border-bottom: 1px solid #f1f3f5;
    padding: 20px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    box-shadow: 0 1px 12px rgba(0,0,0,0.04);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .header-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
  }
  .header-logo {
    width: 40px;
    height: 40px;
    object-fit: contain;
  }
  .header-text { display: flex; flex-direction: column; line-height: 1.2; }
  .header-org  { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.12em; color: #9ca3af; text-transform: uppercase; }
  .header-event{ font-size: 0.85rem; font-weight: 700; color: #374151; }

  .header-title-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    flex: 1;
    flex-wrap: wrap;
  }
  .title-icon-wrap {
    display: flex; align-items: center; justify-content: center;
    width: 36px; height: 36px; border-radius: 50%;
    background: #e8f0fe; color: #4285F4;
  }
  .header-title {
    font-size: clamp(1.4rem, 3vw, 1.8rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    color: #111;
    margin: 0;
    line-height: 1;
  }

  .live-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background: #e6f4ea;
    border: 1px solid #34A85330;
    color: #34A853;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .live-dot {
    width: 6px; height: 6px;
    background: #34A853;
    border-radius: 50%;
    animation: livePulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes livePulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.8); }
  }

  .header-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
  }

  /* ── loading ── */
  .thp-loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: #9ca3af;
    font-size: 0.95rem;
    font-weight: 500;
    padding: 80px 0;
  }
  .spinner {
    width: 48px; height: 48px;
    border: 4px solid #e8f0fe;
    border-top-color: #4285F4;
    border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── main ── */
  .thp-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 40px;
    padding: 40px 28px 60px;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    box-sizing: border-box;
  }

  /* ── stats bar ── */
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .stat-card {
    background: #fff;
    border: 1px solid #f1f3f5;
    border-radius: 20px;
    padding: 20px 24px;
    display: flex;
    align-items: center;
    gap: 18px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .stat-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.06);
  }
  .stat-icon {
    width: 48px; height: 48px;
    border-radius: 14px;
    background: var(--bg-accent, #f8f9fa);
    display: flex; align-items: center; justify-content: center;
    color: var(--accent, #4285F4);
    flex-shrink: 0;
  }
  .stat-body { display: flex; flex-direction: column; min-width: 0; }
  .stat-value {
    font-size: clamp(1.6rem, 2.5vw, 2.2rem);
    font-weight: 900;
    color: #111;
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .stat-label {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-top: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── section heading ── */
  .section-heading {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #9ca3af;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    margin-bottom: 20px;
  }
  .heading-line {
    flex: 1;
    height: 1px;
    background: #f1f3f5;
  }
  .hunters-count-badge {
    background: #f3f4f6;
    color: #6b7280;
    font-size: 0.65rem;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    letter-spacing: 0.1em;
  }

  /* ── levels grid ── */
  .levels-section { display: flex; flex-direction: column; }

  .levels-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 16px;
  }
  /* MEGA level (10th child) spans full row */
  .levels-grid > :nth-child(10) {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 24px 32px;
  }
  .levels-grid > :nth-child(10) .level-label { font-size: 1.1rem; }
  .levels-grid > :nth-child(10) .level-number { font-size: 2.4rem; }

  /* ── level cards ── */
  .level-card {
    border-radius: 20px;
    padding: 20px 18px 18px;
    background: #fff;
    border: 1px solid #f1f3f5;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: default;
    position: relative;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
  }

  /* claimed — green */
  .level-claimed {
    background: #e6f4ea;
    border-color: #34A85340;
  }

  /* open — blue */
  .level-open {
    background: #fff;
    border-color: #4285F440;
    box-shadow: 0 0 0 1px #4285F410;
  }
  .level-open:hover { box-shadow: 0 4px 16px rgba(66,133,244,0.15); }

  /* mega locked — dim */
  .level-mega-locked {
    background: #f9fafb;
    border-color: #e5e7eb;
  }

  /* mega open — gold */
  .level-mega-open {
    background: #fffbeb;
    border-color: #fde68a;
    box-shadow: 0 4px 24px rgba(251,188,4,0.2);
  }

  .level-number-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .level-number {
    font-size: 1.8rem;
    font-weight: 900;
    color: #111;
    line-height: 1;
  }
  .level-mega-locked .level-number { color: #9ca3af; }

  /* status badges */
  .level-status-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 4px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }
  .badge-claimed { background: #d1fae5; color: #059669; border: 1px solid #05966930; }
  .badge-open    { background: #eff6ff; color: #2563eb; border: 1px solid #2563eb30; }
  .badge-locked  { background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb; }
  .badge-mega    { background: #fef3cd; color: #d97706; border: 1px solid #f59e0b50; }

  .level-label {
    font-size: 0.72rem;
    font-weight: 800;
    color: #6b7280;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .level-sub {
    font-size: 0.85rem;
    font-weight: 700;
    color: #374151;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .level-mega-locked .level-sub { color: #9ca3af; }

  .level-hunters-pip {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }
  .pip {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #4285F4;
    animation: pipPulse 1.8s ease-in-out infinite;
  }
  .pip:nth-child(2) { animation-delay: 0.2s; }
  .pip:nth-child(3) { animation-delay: 0.4s; }
  .pip:nth-child(4) { animation-delay: 0.6s; }
  @keyframes pipPulse {
    0%,100% { opacity: 0.3; }
    50%      { opacity: 1; }
  }

  /* ── mega progress ── */
  .mega-progress-wrap {
    margin-top: 24px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #fff;
    padding: 20px 24px;
    border-radius: 16px;
    border: 1px solid #f1f3f5;
    box-shadow: 0 4px 12px rgba(0,0,0,0.02);
  }
  .mega-progress-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8rem;
    color: #d97706;
    font-weight: 600;
  }
  .mega-progress-track {
    height: 8px;
    background: #f3f4f6;
    border-radius: 999px;
    overflow: hidden;
  }
  .mega-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #fcd34d, #f59e0b);
    border-radius: 999px;
  }

  /* ── hunters ── */
  .hunters-feed {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }
  .hunter-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #fff;
    border: 1px solid #f1f3f5;
    border-radius: 14px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  }
  .hunter-avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: #eff6ff;
    color: #2563eb;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800;
    font-size: 0.95rem;
    border: 1px solid #bfdbfe;
    flex-shrink: 0;
  }
  .hunter-info {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .hunter-name {
    font-size: 0.95rem;
    font-weight: 700;
    color: #111;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hunter-level {
    font-size: 0.75rem;
    color: #6b7280;
    font-weight: 600;
    margin-top: 2px;
  }
  .hunters-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px;
    color: #9ca3af;
    font-size: 0.95rem;
    font-weight: 500;
    background: #f9fafb;
    border-radius: 16px;
    border: 1px dashed #e5e7eb;
  }

  /* ── footer ── */
  .thp-footer {
    border-top: 1px solid #f1f3f5;
    padding: 20px 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    background: #fff;
  }
  .footer-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .footer-live-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #34A853;
    animation: livePulse 1.8s ease-in-out infinite;
  }
  .footer-text {
    font-size: 0.75rem;
    color: #9ca3af;
    font-weight: 500;
  }
  .footer-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .footer-dots {
    display: flex;
    gap: 5px;
  }
  .footer-brand {
    font-size: 0.72rem;
    font-weight: 700;
    color: #9ca3af;
    letter-spacing: 0.06em;
  }
`
