import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, CheckCircle, Trophy, ExternalLink, Lightbulb } from 'lucide-react';
import DepthText from './DepthText';
import { isMegaLevel, NORMAL_LEVELS } from '../utils/huntConfig';

/**
 * One level of the hunt.
 *
 * status: 'open'   - hint + code box, up for grabs
 *         'won'    - this player cracked it; show their Google Form
 *         'taken'  - somebody else got there first
 *         'locked' - mega level, hint stays hidden until all 9 are claimed
 */
export default function QRModal({
  isOpen,
  onClose,
  level,
  status,
  hint,
  hintImage,
  claim,
  formUrl,
  claimedCount,
  onCodeSubmit,
}) {
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  // Clear the box whenever a different level is opened.
  React.useEffect(() => {
    setCode('');
    setError('');
    setBusy(false);
  }, [level, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError('');
    const result = await onCodeSubmit(code);
    setBusy(false);
    if (result !== true) setError(result || 'Incorrect code. Try again!');
  };

  const mega = isMegaLevel(level);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm relative text-center text-white shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
          >
            <X size={24} />
          </button>

          <div className="mb-6 mt-4 flex justify-center">
            <DepthText
              text={mega ? 'MEGA' : `LEVEL ${level}`}
              layers={15}
              depth={1.5}
              faceColor="#f8fafc"
              depthColor={mega ? '#FBBC04' : '#4285F4'}
              tilt={10}
              pointerTracking={true}
              smoothing={0.14}
              perspective={900}
              autoOrbit={true}
              orbitSpeed={0.35}
              fontSize={mega ? '3rem' : '2.5rem'}
              fontWeight={900}
              shadow={true}
            />
          </div>

          {/* ---------------- locked mega ---------------- */}
          {status === 'locked' && (
            <div className="py-4">
              <Lock size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-300 font-bold mb-2">The Mega Level is sealed.</p>
              <p className="text-gray-400 text-sm mb-4">
                Its clue appears only after all {NORMAL_LEVELS} levels have been claimed.
              </p>
              <div className="bg-gray-800 rounded-xl p-3">
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#FBBC04] rounded-full transition-all duration-500"
                    style={{ width: `${(claimedCount / NORMAL_LEVELS) * 100}%` }}
                  />
                </div>
                <p className="text-xs font-bold text-gray-400">
                  {claimedCount} of {NORMAL_LEVELS} levels claimed
                </p>
              </div>
            </div>
          )}

          {/* ---------------- already won by someone else ---------------- */}
          {status === 'taken' && (
            <div className="py-4">
              <Trophy size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-300 font-bold mb-1">Already claimed!</p>
              <p className="text-gray-400 text-sm">
                <span className="text-[#FBBC04] font-bold">{claim?.displayName || 'Someone'}</span>{' '}
                cracked this one first.
              </p>
              <p className="text-gray-500 text-xs mt-4">
                Every level has just one winner. Try another.
              </p>
            </div>
          )}

          {/* ---------------- this player won it ---------------- */}
          {status === 'won' && (
            <div className="py-2">
              <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
              <p className="text-emerald-400 font-bold text-lg mb-1">You claimed this level!</p>
              <p className="text-gray-400 text-sm mb-6">
                Fill in the form below to collect your prize.
              </p>
              {formUrl ? (
                <a
                  href={formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition-colors shadow-lg"
                >
                  Open Claim Form <ExternalLink size={18} />
                </a>
              ) : (
                <p className="text-yellow-400 text-sm bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                  No form link set for this level yet — please show this screen to a GDG volunteer.
                </p>
              )}
            </div>
          )}

          {/* ---------------- up for grabs ---------------- */}
          {status === 'open' && (
            <>
              <div className="bg-gray-800/80 border border-gray-700 rounded-2xl p-4 mb-5 text-left">
                <div className="flex items-center gap-2 mb-2 text-[#FBBC04]">
                  <Lightbulb size={16} />
                  <span className="text-xs font-black uppercase tracking-wider">Your Clue</span>
                </div>
                <p className={`text-gray-200 text-sm leading-relaxed ${hintImage ? 'mb-3' : ''}`}>
                  {hint || 'No clue has been set for this level yet.'}
                </p>
                {hintImage && (
                  <img src={hintImage} alt="Clue" className="w-full h-auto rounded-xl object-contain bg-gray-900 border border-gray-700 max-h-48" />
                )}
              </div>

              <p className="text-gray-400 text-xs mb-4">
                Find the QR code, then enter the secret code. First correct answer wins this level.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="Enter Secret Code"
                    autoComplete="off"
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck="false"
                    className={`w-full bg-gray-800 border ${
                      error ? 'border-red-500' : 'border-gray-600'
                    } rounded-xl px-4 py-3 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-blue-500 transition-colors`}
                  />
                  {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
                </div>
                <button
                  type="submit"
                  disabled={busy || !code.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/50"
                >
                  {busy ? 'Checking…' : 'CLAIM LEVEL'}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
