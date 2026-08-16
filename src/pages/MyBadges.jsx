import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Award, CheckCircle2, Download, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  BADGE_RULES_VERSION,
  CREDENTIAL_URL,
  createBadgeSnapshot,
  getBadgeEligibility,
} from '../utils/badgeRules';
import { getEmailKey } from '../utils/credentialKeys';

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const formatClaimDate = (claimedAt) => {
  if (!claimedAt) return 'Recently issued';
  const date = claimedAt.toDate ? claimedAt.toDate() : new Date(claimedAt);
  if (Number.isNaN(date.getTime())) return 'Recently issued';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const createBadgeSvg = ({ badge, name, email, issued }) => {
  const safeName = escapeXml(name || 'GDG Player');
  const safeEmail = escapeXml(email || '');
  const safeIssued = escapeXml(issued || 'Recently issued');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="760" height="980" viewBox="0 0 760 980">
  <defs>
    <radialGradient id="badgeGlow" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="${badge.glow}" stop-opacity="0.72"/>
      <stop offset="48%" stop-color="${badge.accent}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="coin" x1="16%" y1="14%" x2="84%" y2="88%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="38%" stop-color="${badge.accent}"/>
      <stop offset="100%" stop-color="${badge.glow}"/>
    </linearGradient>
    <linearGradient id="ribbon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${badge.ribbon}"/>
      <stop offset="100%" stop-color="${badge.accent}"/>
    </linearGradient>
    <filter id="softShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="${badge.glow}" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="760" height="980" rx="52" fill="#11154a"/>
  <circle cx="380" cy="368" r="300" fill="url(#badgeGlow)"/>
  <path d="M282 570 L282 764 L348 718 L380 788 L412 718 L478 764 L478 570 Z" fill="url(#ribbon)" opacity="0.98"/>
  <circle cx="380" cy="350" r="214" fill="#020617" opacity="0.3"/>
  <circle cx="380" cy="338" r="198" fill="url(#coin)" filter="url(#softShadow)"/>
  <circle cx="380" cy="338" r="168" fill="#ffffff" opacity="0.34"/>
  <path d="M380 186 C456 186 518 248 518 324 C518 400 456 462 380 462 C304 462 242 400 242 324 C242 248 304 186 380 186 Z" fill="#ffffff" opacity="0.18"/>
  <path d="M380 208 L418 284 L502 296 L441 356 L456 440 L380 400 L304 440 L319 356 L258 296 L342 284 Z" fill="#ffffff"/>
  <path d="M380 250 L405 302 L462 310 L421 350 L431 406 L380 379 L329 406 L339 350 L298 310 L355 302 Z" fill="${badge.accent}"/>
  <circle cx="232" cy="254" r="13" fill="#ffffff" opacity="0.85"/>
  <circle cx="542" cy="470" r="10" fill="#ffffff" opacity="0.76"/>
  <path d="M564 216 L574 238 L596 248 L574 258 L564 280 L554 258 L532 248 L554 238 Z" fill="#ffffff" opacity="0.85"/>
  <text x="380" y="106" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="3">${escapeXml(badge.tier.toUpperCase())} BADGE</text>
  <text x="380" y="642" text-anchor="middle" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="900">${escapeXml(badge.title)}</text>
  <text x="380" y="694" text-anchor="middle" fill="#cbd5e1" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">${escapeXml(badge.subtitle)}</text>
  <rect x="110" y="748" width="540" height="116" rx="28" fill="#ffffff" opacity="0.95"/>
  <text x="380" y="798" text-anchor="middle" fill="${badge.text}" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="800">${safeName}</text>
  <text x="380" y="834" text-anchor="middle" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">${safeEmail}</text>
  <text x="380" y="910" text-anchor="middle" fill="#e2e8f0" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700">GDG On Campus SRMCEM • ${safeIssued}</text>
</svg>`.trim();
};

function BadgeArtwork({ badge, name, email, issued }) {
  const svg = useMemo(() => createBadgeSvg({ badge, name, email, issued }), [badge, name, email, issued]);
  return (
    <div
      className="w-full aspect-[760/980] rounded-2xl overflow-hidden bg-slate-950 shadow-xl"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function MyBadges() {
  const navigate = useNavigate();
  const [user, setUser] = useState(auth.currentUser);
  const [scoreData, setScoreData] = useState(null);
  const [claimedBadges, setClaimedBadges] = useState({});
  const [manualAwards, setManualAwards] = useState([]);
  const [activeClaim, setActiveClaim] = useState(null);
  const [claimName, setClaimName] = useState('');
  const [saving, setSaving] = useState(false);
  const [successBadge, setSuccessBadge] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) return undefined;
    const emailKey = getEmailKey(user.email);
    const scoreUnsub = onSnapshot(doc(db, 'arcadeScores', user.uid), (snap) => {
      setScoreData(snap.exists() ? snap.data() : {});
    });

    const badgeUnsub = onSnapshot(collection(db, 'credentialBadges', user.uid, 'badges'), (snap) => {
      const nextBadges = {};
      snap.forEach((badgeDoc) => {
        nextBadges[badgeDoc.id] = { id: badgeDoc.id, ...badgeDoc.data() };
      });
      setClaimedBadges(nextBadges);
    });

    const manualAwardsUnsub = onSnapshot(collection(db, 'manualCredentialBadges', emailKey, 'badges'), (snap) => {
      const nextAwards = [];
      snap.forEach((awardDoc) => {
        nextAwards.push({
          id: awardDoc.id,
          order: 1000 + nextAwards.length,
          eligible: true,
          progressText: 'Issued by GDG SRMCEM',
          ...awardDoc.data(),
        });
      });
      setManualAwards(nextAwards.sort((a, b) => (b.issuedAt?.seconds || 0) - (a.issuedAt?.seconds || 0)));
    });

    return () => {
      scoreUnsub();
      badgeUnsub();
      manualAwardsUnsub();
    };
  }, [user]);

  const badges = useMemo(() => {
    const arcadeBadges = getBadgeEligibility(scoreData || {});
    const eventBadges = manualAwards.map((award) => ({
      ...award,
      badgeId: award.id,
      id: award.id,
      source: 'manual',
      title: award.title,
      shortTitle: award.shortTitle || award.title,
      tier: award.tier || 'Event',
      subtitle: award.subtitle || award.eventName || 'GDG Event Badge',
      description: award.description || `Awarded for ${award.eventName || 'a GDG event'}.`,
      accent: award.accent || '#38bdf8',
      glow: award.glow || '#2563eb',
      ribbon: award.ribbon || '#dbeafe',
      text: award.text || '#0f172a',
      eligible: true,
      progressText: 'Issued by GDG SRMCEM',
    }));

    return [...arcadeBadges, ...eventBadges];
  }, [manualAwards, scoreData]);

  const beginClaim = (badge) => {
    setActiveClaim(badge.id);
    setClaimName(user?.displayName || '');
    setError('');
  };

  const claimBadge = async (badge) => {
    const trimmedName = claimName.trim().replace(/\s+/g, ' ');
    if (!badge.eligible || !user) return;
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setError('Please enter a name between 2 and 60 characters.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const claimPayload = {
        badgeId: badge.id,
        source: badge.source || 'arcade',
        templateId: badge.templateId || null,
        title: badge.title,
        tier: badge.tier,
        eventName: badge.eventName || null,
        subtitle: badge.subtitle || '',
        description: badge.description || '',
        accent: badge.accent || '#38bdf8',
        glow: badge.glow || '#2563eb',
        ribbon: badge.ribbon || '#dbeafe',
        text: badge.text || '#0f172a',
        claimedName: trimmedName,
        userId: user.uid,
        recipientEmail: user.email || '',
        recipientDisplayName: user.displayName || '',
        permanentUrl: CREDENTIAL_URL,
        issuer: 'GDG On Campus SRMCEM',
        rulesVersion: BADGE_RULES_VERSION,
        scoreSnapshot: createBadgeSnapshot(scoreData || {}),
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'credentialBadges', user.uid), {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await setDoc(doc(db, 'credentialBadges', user.uid, 'badges', badge.id), claimPayload, { merge: true });

      setSuccessBadge(badge.id);
      setActiveClaim(null);
      setClaimName('');
    } catch (claimError) {
      console.error('Failed to claim badge:', claimError);
      setError('Could not claim the badge right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const downloadBadge = (badge, claim) => {
    const svg = createBadgeSvg({
      badge,
      name: claim.claimedName,
      email: claim.recipientEmail,
      issued: formatClaimDate(claim.claimedAt),
    });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${badge.id}-${claim.claimedName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const claimableCount = badges.filter((badge) => badge.eligible && !claimedBadges[badge.id]).length;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/arcade')}
            className="p-2 rounded-full hover:bg-white/10 text-slate-300 transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={22} />
            <span className="hidden sm:inline font-semibold">Arcade</span>
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-cyan-300" size={24} />
            <span className="font-black tracking-tight">My GDG Badges</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-10">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-400/15 text-cyan-200 flex items-center justify-center">
                <Award size={26} />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">Credential Badges</h1>
                <p className="text-slate-300 text-sm md:text-base">{user?.email}</p>
              </div>
            </div>
            <p className="text-slate-300 max-w-2xl leading-relaxed">
              Claim your earned GDG Arcade digital badges, personalize them with your name, and keep them available through your Google sign-in.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-6 flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-200 mb-2">Permanent Link</p>
              <p className="text-sm text-cyan-50 break-all">{CREDENTIAL_URL}</p>
            </div>
            <p className="text-xs text-cyan-100/80">
              Badges are linked to your Gmail account and appear here after signing in.
            </p>
          </div>
        </section>

        {successBadge && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4 text-emerald-50 flex items-start gap-3"
          >
            <CheckCircle2 className="text-emerald-300 shrink-0 mt-0.5" />
            <p className="text-sm md:text-base">
              Badge received successfully. It will be reflected and stored at <span className="font-bold">{CREDENTIAL_URL}</span> for future showcase after Gmail sign-in.
            </p>
          </motion.div>
        )}

        {scoreData === null ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-10 text-center text-slate-300">
            Loading your arcade record...
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Available Badges</h2>
                <p className="text-sm text-slate-400">{claimableCount} ready to claim</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-300 bg-white/5 border border-white/10 px-4 py-2 rounded-full">
                <Sparkles size={16} className="text-yellow-200" />
                Rules: {BADGE_RULES_VERSION}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {badges.map((badge) => {
                const claim = claimedBadges[badge.id];
                const isClaiming = activeClaim === badge.id;
                const issued = formatClaimDate(claim?.claimedAt);

                return (
                  <motion.article
                    key={badge.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/10 bg-white/[0.06] overflow-hidden"
                  >
                    <div className="p-4">
                      <BadgeArtwork
                        badge={badge}
                        name={claim?.claimedName || badge.shortTitle}
                        email={claim?.recipientEmail || user?.email}
                        issued={claim ? issued : 'Ready to claim'}
                      />
                    </div>

                    <div className="p-5 pt-2">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="text-xl font-black">{badge.title}</h3>
                          <p className="text-sm text-slate-400">{badge.description}</p>
                        </div>
                        {!badge.eligible && <Lock className="text-slate-500 shrink-0" size={22} />}
                        {claim && <CheckCircle2 className="text-emerald-300 shrink-0" size={22} />}
                      </div>

                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                        {claim ? `Issued ${issued}` : badge.progressText}
                      </div>

                      {claim ? (
                        <button
                          onClick={() => downloadBadge(badge, claim)}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-950 py-3 font-black hover:bg-slate-100 transition-colors"
                        >
                          <Download size={18} />
                          Download SVG
                        </button>
                      ) : isClaiming ? (
                        <div className="space-y-3">
                          <input
                            value={claimName}
                            onChange={(e) => setClaimName(e.target.value)}
                            maxLength={60}
                            placeholder="Name on badge"
                            className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-300"
                          />
                          {error && <p className="text-sm text-red-300">{error}</p>}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setActiveClaim(null)}
                              className="rounded-xl bg-white/10 py-3 font-bold text-slate-200 hover:bg-white/15 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => claimBadge(badge)}
                              disabled={saving}
                              className="rounded-xl bg-cyan-300 py-3 font-black text-slate-950 hover:bg-cyan-200 transition-colors disabled:opacity-60"
                            >
                              {saving ? 'Saving...' : 'Done'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => beginClaim(badge)}
                          disabled={!badge.eligible}
                          className={`w-full rounded-xl py-3 font-black transition-colors ${
                            badge.eligible
                              ? 'bg-cyan-300 text-slate-950 hover:bg-cyan-200'
                              : 'bg-white/10 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          {badge.eligible ? 'Claim Badge' : 'Locked'}
                        </button>
                      )}
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
