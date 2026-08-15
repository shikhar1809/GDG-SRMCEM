import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Check } from 'lucide-react';

export default function LevelNode({ level, x, y, currentLevel, onClick }) {
  const isLocked = level > currentLevel;
  const isCompleted = level < currentLevel;
  const isCurrent = level === currentLevel;

  return (
    <div 
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <motion.button
        onClick={() => onClick(level)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        animate={isCurrent ? {
          y: [0, -10, 0],
        } : {}}
        transition={isCurrent ? { repeat: Infinity, duration: 2 } : {}}
        className="relative group"
      >
        {/* Node Circle */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-4 transition-all duration-500 ${
          isCompleted ? 'bg-emerald-500 border-emerald-300 shadow-emerald-500/50' : 
          isCurrent ? 'bg-blue-500 border-blue-300 shadow-blue-500/50' : 
          'bg-gray-800 border-gray-600 shadow-black/50 grayscale opacity-80'
        }`}>
          {isCompleted ? (
            <Check size={28} className="text-white" strokeWidth={3} />
          ) : isLocked ? (
            <Lock size={24} className="text-gray-400" strokeWidth={2.5} />
          ) : (
            <span className="text-white font-black text-2xl">{level}</span>
          )}
        </div>

        {/* Current Level Indicator */}
        {isCurrent && (
          <div className="absolute -top-3 -right-3">
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-500 border border-yellow-300"></span>
            </span>
          </div>
        )}
      </motion.button>
    </div>
  );
}
