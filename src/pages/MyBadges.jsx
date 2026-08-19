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
import { badgeBgBase64 } from '../utils/badgeBgBase64';
import LoadingScreen from '../components/LoadingScreen';
import { useMinLoadTime } from '../hooks/useMinLoadTime';

const escapeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const formatClaimDate = (claimedAt) => {
  if (!claimedAt) return 'Recently issued';
  const date = claimedAt.toDate ? claimedAt.toDate() : new Date(claimedAt);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const createBadgeSvg = ({ badge, name, email, issued }) => {
  const safeName = escapeXml(name || 'GDG Player');
  const bgImage = badge?.bgUrl ? badge.bgUrl : `data:image/jpeg;base64,${badgeBgBase64}`;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 1024 1024">
  <image href="${bgImage}" x="0" y="0" width="1024" height="1024" preserveAspectRatio="xMidYMid slice" />
  <rect x="230" y="695" width="564" height="110" rx="30" fill="#ffffff" />
  <text x="512" y="765" text-anchor="middle" fill="#64748b" font-family="Arial, sans-serif" font-size="52" font-weight="800" letter-spacing="2">${safeName.toUpperCase()}</text>
</svg>`.trim();
};

function BadgeArtwork({ badge, name, email, issued }) {
  const svg = useMemo(() => createBadgeSvg({ badge, name, email, issued }), [badge, name, email, issued]);
  return (
    <div
      className="w-full aspect-square rounded-2xl overflow-hidden bg-gray-50 shadow-md border border-gray-200"
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
  const [openCreds, setOpenCreds] = useState([]);
  const [lockedCreds, setLockedCreds] = useState({});
  const [activeClaim, setActiveClaim] = useState(null);
  const [claimName, setClaimName] = useState('');
  const [saving, setSaving] = useState(false);
  const [successBadge, setSuccessBadge] = useState(null);
  const [fullscreenBadge, setFullscreenBadge] = useState(null);
  const [error, setError] = useState('');

  const displayLoading = useMinLoadTime(scoreData === null, 3000);

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

    const openCredsUnsub = onSnapshot(collection(db, 'openCredentials'), (snap) => {
      const creds = [];
      const locked = {};
      snap.forEach(d => {
        const data = d.data();
        if (data.isActive) {
          creds.push({
            id: d.id,
            badgeId: d.id,
            source: 'open',
            title: data.title,
            shortTitle: data.title,
            subtitle: data.subtitle,
            tier: 'Event',
            bgUrl: data.bgUrl,
            eligible: true,
            progressText: 'Available to Claim',
            order: 2000 + creds.length
          });
        } else {
          locked[d.id] = true;
        }
      });
      setOpenCreds(creds);
      setLockedCreds(locked);
    });

    return () => {
      scoreUnsub();
      badgeUnsub();
      manualAwardsUnsub();
      openCredsUnsub();
    };
  }, [user]);

  const badges = useMemo(() => {
    let arcadeBadges = getBadgeEligibility(scoreData || {});
    arcadeBadges = arcadeBadges.filter(b => !lockedCreds[b.id]);
    
    const activeOpenCreds = openCreds.filter(c => c.id !== 'welcome-badge');

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

    return [...arcadeBadges, ...eventBadges, ...activeOpenCreds];
  }, [manualAwards, scoreData, openCreds, lockedCreds]);

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
        bgUrl: badge.bgUrl || null,
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
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-gray-100 text-slate-600 transition-colors flex items-center gap-2"
          >
            <ArrowLeft size={22} />
            <span className="hidden sm:inline font-semibold">Home</span>
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-blue-600" size={24} />
            <span className="font-black tracking-tight text-slate-900">My GDG Badges</span>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 md:py-10">
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-8">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <Award size={26} />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">Credential Badges</h1>
                <p className="text-slate-500 text-sm md:text-base">{user?.email}</p>
              </div>
            </div>
            <p className="text-slate-600 max-w-2xl leading-relaxed">
              Claim your earned GDG Arcade digital badges, personalize them with your name, and keep them available through your Google sign-in.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-2">Permanent Link</p>
              <p className="text-sm text-blue-900 break-all font-medium">{CREDENTIAL_URL}</p>
            </div>
            <p className="text-xs text-blue-700/80">
              Badges are linked to your Gmail account and appear here after signing in.
            </p>
          </div>
        </section>

        {successBadge && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 flex items-start gap-3"
          >
            <CheckCircle2 className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-sm md:text-base">
              Badge received successfully. It will be reflected and stored at <span className="font-bold">{CREDENTIAL_URL}</span> for future showcase after Gmail sign-in.
            </p>
          </motion.div>
        )}

        {displayLoading ? (
          <div className="relative h-[60vh] w-full rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
            <LoadingScreen text="Loading your record..." />
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-slate-900">Available Badges</h2>
                <p className="text-sm text-slate-500">{claimableCount} ready to claim</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-gray-50 border border-gray-200 px-4 py-2 rounded-full">
                <Sparkles size={16} className="text-yellow-500" />
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
                    className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                  >
                    <div className="p-4" onClick={() => claim ? setFullscreenBadge({ badge, claim, issued }) : null} style={{ cursor: claim ? 'pointer' : 'default' }}>
                      <BadgeArtwork
                        badge={badge}
                        name={claim?.claimedName || badge.shortTitle}
                        email={claim?.recipientEmail || user?.email}
                        issued={claim ? issued : 'Ready to claim'}
                      />
                    </div>

                    <div className="p-5 pt-2 flex flex-col flex-1 justify-between bg-gray-50/50 border-t border-gray-100">
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <h3 className="text-xl font-black text-slate-900">{badge.title}</h3>
                            <p className="text-sm text-slate-500">{badge.description}</p>
                          </div>
                          {!badge.eligible && <Lock className="text-slate-400 shrink-0" size={22} />}
                          {claim && <CheckCircle2 className="text-emerald-500 shrink-0" size={22} />}
                        </div>

                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                          {claim ? `Issued ${issued}` : badge.progressText}
                        </div>
                      </div>

                      {claim ? (
                        <div className="grid grid-cols-2 gap-2 mt-auto">
                          <button
                            onClick={() => setFullscreenBadge({ badge, claim, issued })}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 py-3 font-bold hover:bg-blue-100 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => downloadBadge(badge, claim)}
                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white py-3 font-bold hover:bg-slate-800 transition-colors shadow-sm"
                          >
                            <Download size={18} />
                            Save
                          </button>
                        </div>
                      ) : isClaiming ? (
                        <div className="space-y-3 mt-auto">
                          <input
                            value={claimName}
                            onChange={(e) => setClaimName(e.target.value)}
                            maxLength={60}
                            placeholder="Name on badge"
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-slate-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                          />
                          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => setActiveClaim(null)}
                              className="rounded-xl bg-gray-100 py-3 font-bold text-slate-600 hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => claimBadge(badge)}
                              disabled={saving}
                              className="rounded-xl bg-blue-600 py-3 font-black text-white hover:bg-blue-700 transition-colors disabled:opacity-60 shadow-sm"
                            >
                              {saving ? 'Saving...' : 'Done'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => beginClaim(badge)}
                          disabled={!badge.eligible}
                          className={`w-full rounded-xl py-3 font-black transition-colors mt-auto shadow-sm ${
                            badge.eligible
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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

      {/* FULLSCREEN BADGE MODAL */}
      {fullscreenBadge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-4 flex justify-between items-center border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-black text-slate-900 px-2">{fullscreenBadge.badge.title}</h3>
              <button 
                onClick={() => setFullscreenBadge(null)}
                className="w-10 h-10 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center text-slate-600 transition-colors"
              >
                &times;
              </button>
            </div>
            <div className="p-6 md:p-8 flex justify-center items-center bg-gray-100/50">
              <div className="w-full max-w-sm drop-shadow-xl">
                <BadgeArtwork
                  badge={fullscreenBadge.badge}
                  name={fullscreenBadge.claim.claimedName}
                  email={fullscreenBadge.claim.recipientEmail}
                  issued={fullscreenBadge.issued}
                />
              </div>
            </div>
            <div className="p-6 bg-white border-t border-gray-100 space-y-4">
              <div className="text-center">
                <p className="text-blue-600 font-bold mb-1">Issued to {fullscreenBadge.claim.claimedName}</p>
                <p className="text-slate-500 text-sm">Issued {fullscreenBadge.issued}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => downloadBadge(fullscreenBadge.badge, fullscreenBadge.claim)}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-sm"
                >
                  <Download size={18} /> Download
                </button>
                <button
                  onClick={() => setFullscreenBadge(null)}
                  className="w-full bg-gray-100 text-slate-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
