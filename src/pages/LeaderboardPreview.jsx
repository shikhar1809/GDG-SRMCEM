import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Zap, Brain, Eye, Ghost, Flame } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

// ─── Game config ──────────────────────────────────────────────────────────────

const GAMES = [
  { key: 'tech-recall',    label: 'Tech Recall',    color: '#4285F4', bg: '#e8f0fe', icon: Brain  },
  { key: 'tech-quiz',      label: 'Tech-O-Fire',    color: '#EA4335', bg: '#fce8e6', icon: Flame  },
  { key: 'prompt-wars',    label: 'Prompt Wars',    color: '#FBBC04', bg: '#fef3cd', icon: Zap    },
  { key: 'ai-eye',         label: 'AI Eye',         color: '#34A853', bg: '#e6f4ea', icon: Eye    },
  { key: 'guess-impostor', label: 'Guess Impostor', color: '#9334e6', bg: '#f3e8ff', icon: Ghost  },
  { key: 'guess-the-trivia', label: 'Guess Trivia', color: '#FF5722', bg: '#ffebee', icon: Brain  },
];

const RANK_CONFIG = [
  { emoji: '🥇', label: 'Champion',   accent: '#FBBC04', border: '#fde68a', bg: '#fffbeb' },
  { emoji: '🥈', label: 'Runner-up',  accent: '#9ca3af', border: '#d1d5db', bg: '#f9fafb' },
  { emoji: '🥉', label: '3rd Place',  accent: '#cd7f32', border: '#fcd9ab', bg: '#fff7ed' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}

function GameBadge({ game, score }) {
  const Icon = game.icon;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999,
      fontSize: '0.75rem', fontWeight: 700,
      color: game.color, background: game.bg,
      border: `1px solid ${game.color}30`,
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {game.label}: <strong style={{ marginLeft: 2 }}>{score ?? 0}</strong>
    </span>
  );
}

// ─── Podium Card (Top 3) ──────────────────────────────────────────────────────

function PodiumCard({ player, index }) {
  const cfg = RANK_CONFIG[index];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
      style={{
        background: cfg.bg,
        border: `2px solid ${cfg.border}`,
        borderRadius: 24,
        padding: '28px 24px 22px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}
    >
      {/* Subtle top accent line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: cfg.accent, borderRadius: '24px 24px 0 0' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16, marginTop: 8 }}>
        <div style={{ fontSize: '3.2rem', lineHeight: 1, flexShrink: 0 }}>{cfg.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: cfg.accent, marginBottom: 3 }}>
            #{index + 1} · {cfg.label}
          </div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#111', lineHeight: 1.2, wordBreak: 'break-word' }}>
            {player.displayName || 'Anonymous'}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {player.email}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: cfg.accent, lineHeight: 1, letterSpacing: '-0.02em' }}>{player.totalScore ?? 0}</div>
          <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase' }}>pts</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {GAMES.map(g => player[`played_${g.key}`] && (
          <GameBadge key={g.key} game={g} score={player[`score_${g.key}`]} />
        ))}
        {!GAMES.some(g => player[`played_${g.key}`]) && (
          <span style={{ fontSize: '0.75rem', color: '#d1d5db', fontStyle: 'italic' }}>No games yet</span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Regular Rank Row ─────────────────────────────────────────────────────────

function RankRow({ player, index }) {
  const avatarColors = ['#4285F4', '#EA4335', '#FBBC04', '#34A853', '#9334e6'];
  const avatarColor = avatarColors[index % avatarColors.length];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.5) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px', borderRadius: 14,
        background: index % 2 === 0 ? '#f8faff' : '#fff',
        border: '1px solid #f1f3f5',
        transition: 'box-shadow 0.2s',
      }}
    >
      <div style={{ fontSize: '1.1rem', fontWeight: 900, color: '#d1d5db', minWidth: 36, textAlign: 'right' }}>
        {index + 1}
      </div>

      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: avatarColor + '18', border: `2px solid ${avatarColor}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.95rem', fontWeight: 800, color: avatarColor,
      }}>
        {(player.displayName || '?')[0].toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {player.displayName || 'Anonymous'}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {player.email}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' }}>
        {GAMES.map(g => player[`played_${g.key}`] && (
          <GameBadge key={g.key} game={g} score={player[`score_${g.key}`]} />
        ))}
        {!GAMES.some(g => player[`played_${g.key}`]) && (
          <span style={{ fontSize: '0.72rem', color: '#d1d5db', fontStyle: 'italic' }}>—</span>
        )}
      </div>

      <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#111', minWidth: 56, textAlign: 'right', letterSpacing: '-0.02em', flexShrink: 0 }}>
        {player.totalScore ?? 0}
        <span style={{ fontSize: '0.6rem', fontWeight: 500, color: '#9ca3af', marginLeft: 2 }}>pts</span>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeaderboardPreview() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const now = useNow();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'arcadeScores'), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0));
      setPlayers(data);
      setLastRefresh(new Date());
      setLoading(false);
    }, err => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  const podium = players.slice(0, 3);
  const rest   = players.slice(3);

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Google Sans', 'Segoe UI', sans-serif", color: '#111' }}>

      {/* ── Decorative top bar ── */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #4285F4 0%, #EA4335 33%, #FBBC04 66%, #34A853 100%)' }} />

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          background: '#fff',
          borderBottom: '1px solid #f1f3f5',
          padding: '24px 40px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16,
          boxShadow: '0 1px 12px rgba(0,0,0,0.04)',
          position: 'sticky', top: 0, zIndex: 10,
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/gdg_logo.png" alt="GDG" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#9ca3af' }}>GDG SRMCEM</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151' }}>Arcade 2026</div>
          </div>
        </div>

        {/* Title */}
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 4 }}>
            <Trophy size={22} color="#FBBC04" />
            <h1 style={{ margin: 0, fontSize: 'clamp(1.4rem, 3vw, 2rem)', fontWeight: 900, letterSpacing: '-0.02em', color: '#111' }}>
              Arcade Leaderboard
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: '#e6f4ea', border: '1px solid #34A85330', borderRadius: 999,
              padding: '2px 10px', fontSize: '0.7rem', fontWeight: 700, color: '#34A853', letterSpacing: '0.08em',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34A853', animation: 'livePulse 1.8s ease-in-out infinite' }} />
              LIVE
            </span>
            <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Real-time rankings</span>
          </div>
        </div>

        {/* Clock */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#374151', letterSpacing: '0.02em' }}>
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#d1d5db', fontWeight: 500 }}>
            {players.length} participant{players.length !== 1 ? 's' : ''}
          </div>
        </div>
      </motion.header>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 28px 60px' }}>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ width: 48, height: 48, margin: '0 auto 16px', border: '4px solid #e8f0fe', borderTopColor: '#4285F4', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
            <p style={{ color: '#9ca3af', fontWeight: 500 }}>Fetching scores…</p>
          </div>
        )}

        {/* Empty */}
        {!loading && players.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '80px 0' }}>
            <Trophy size={52} color="#fde68a" style={{ margin: '0 auto 12px' }} />
            <p style={{ color: '#9ca3af', fontWeight: 500, fontSize: '1.1rem' }}>No scores yet — games haven't started!</p>
          </motion.div>
        )}

        {/* ── Podium ── */}
        {!loading && podium.length > 0 && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Trophy size={16} color="#FBBC04" />
              <h2 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9ca3af' }}>Top Players</h2>
              <div style={{ flex: 1, height: 1, background: '#f1f3f5' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${podium.length}, 1fr)`, gap: 20 }}>
              <AnimatePresence mode="popLayout">
                {podium.map((p, i) => <PodiumCard key={p.id} player={p} index={i} />)}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── Rest of leaderboard ── */}
        {!loading && rest.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <Star size={15} color="#4285F4" />
              <h2 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9ca3af' }}>All Players</h2>
              <div style={{ flex: 1, height: 1, background: '#f1f3f5' }} />
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#d1d5db' }}>{players.length} total</span>
            </div>
            <div style={{ background: '#fff', border: '1px solid #f1f3f5', borderRadius: 20, overflow: 'hidden', padding: '6px' }}>
              <AnimatePresence mode="popLayout">
                {rest.map((p, i) => <RankRow key={p.id} player={p} index={i + 3} />)}
              </AnimatePresence>
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid #f1f3f5',
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34A853', animation: 'livePulse 1.8s ease-in-out infinite' }} />
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>Live via Firestore</span>
          {lastRefresh && <span style={{ fontSize: '0.7rem', color: '#d1d5db' }}>· synced {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
        </div>

        {/* GDG colour dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {['#4285F4','#EA4335','#FBBC04','#34A853'].map((c, i) => (
            <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
          ))}
          <span style={{ marginLeft: 6, fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.06em' }}>GDG SRMCEM · Arcade 2026</span>
        </div>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes livePulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.4; transform:scale(0.8); } }
      `}</style>
    </div>
  );
}
