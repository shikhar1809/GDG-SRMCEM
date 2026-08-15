import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, Trophy, Star } from 'lucide-react';
import { isMegaLevel } from '../utils/huntConfig';

/**
 * One node on the hunt board.
 *   open   - up for grabs, pulses to invite a tap
 *   won    - this player claimed it
 *   taken  - someone else claimed it
 *   locked - mega level, still sealed
 */
export default function LevelNode({ level, x, y, status, claimName, onClick }) {
  const mega = isMegaLevel(level);
  const size = mega ? 'w-20 h-20' : 'w-16 h-16';

  const ring = {
    won: 'bg-emerald-500 border-emerald-300 shadow-emerald-500/50',
    taken: 'bg-gray-700 border-gray-600 shadow-black/40',
    locked: 'bg-gray-800 border-gray-600 shadow-black/50 grayscale opacity-80',
    open: mega
      ? 'bg-[#FBBC04] border-yellow-200 shadow-yellow-500/50'
      : 'bg-blue-500 border-blue-300 shadow-blue-500/50',
  }[status];

  return (
    <div
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <motion.button
        onClick={() => onClick(level)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={status === 'open' ? { y: [0, -10, 0] } : {}}
        transition={status === 'open' ? { repeat: Infinity, duration: 2 } : {}}
        className="relative group"
        aria-label={`Level ${level}, ${status}`}
      >
        <div
          className={`${size} rounded-full flex items-center justify-center shadow-lg border-4 transition-all duration-500 ${ring}`}
        >
          {status === 'won' ? (
            <Check size={mega ? 34 : 28} className="text-white" strokeWidth={3} />
          ) : status === 'taken' ? (
            <Trophy size={mega ? 28 : 22} className="text-gray-400" strokeWidth={2.5} />
          ) : status === 'locked' ? (
            <Lock size={24} className="text-gray-400" strokeWidth={2.5} />
          ) : mega ? (
            <Star size={34} className="text-white fill-current" strokeWidth={2} />
          ) : (
            <span className="text-white font-black text-2xl">{level}</span>
          )}
        </div>

        {/* Winner's name under a claimed node, so the board reads as a scoreboard. */}
        {(status === 'won' || status === 'taken') && claimName && (
          <span
            className={`absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-full max-w-[110px] truncate ${
              status === 'won' ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-300'
            }`}
          >
            {status === 'won' ? 'You!' : claimName}
          </span>
        )}

        {status === 'open' && (
          <div className="absolute -top-3 -right-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500 border border-yellow-300" />
            </span>
          </div>
        )}
      </motion.button>
    </div>
  );
}
