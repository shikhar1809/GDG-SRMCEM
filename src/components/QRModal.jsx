import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, CheckCircle } from 'lucide-react';
import DepthText from './DepthText';

export default function QRModal({ isOpen, onClose, level, currentLevel, onCodeSubmit }) {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState(false);

  if (!isOpen) return null;

  const isLocked = level > currentLevel;
  const isCompleted = level < currentLevel;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.trim() === "") return;
    
    // Pass to parent to validate
    const success = onCodeSubmit(code);
    if (!success) {
      setError(true);
      setTimeout(() => setError(false), 2000);
    } else {
      setCode("");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm relative text-center text-white shadow-2xl"
        >
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>

          <div className="mb-8 mt-4 flex justify-center">
            <DepthText
              text={`LEVEL ${level}`}
              layers={15}
              depth={1.5}
              faceColor="#f8fafc"
              depthColor="#4285F4"
              tilt={10}
              pointerTracking={true}
              smoothing={0.14}
              perspective={900}
              autoOrbit={true}
              orbitSpeed={0.35}
              fontSize="3rem"
              fontWeight={900}
              shadow={true}
            />
          </div>
          <div className="mb-6">
            {isLocked ? (
              <p className="text-gray-400 text-sm">You must complete previous levels first.</p>
            ) : isCompleted ? (
              <p className="text-emerald-400 text-sm font-semibold flex items-center justify-center gap-1">
                <CheckCircle size={16} /> Completed
              </p>
            ) : (
              <p className="text-gray-300 text-sm">Scan the QR code at the location and enter the secret code below.</p>
            )}
          </div>

          {!isLocked && !isCompleted && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter Secret Code"
                  className={`w-full bg-gray-800 border ${error ? 'border-red-500' : 'border-gray-600'} rounded-xl px-4 py-3 text-center text-xl font-bold tracking-widest focus:outline-none focus:border-blue-500 transition-colors`}
                />
                {error && <p className="text-red-500 text-xs mt-2">Incorrect Code. Try again!</p>}
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-colors shadow-lg shadow-blue-900/50"
              >
                UNLOCK LEVEL
              </button>
            </form>
          )}

          {isLocked && (
            <div className="py-8 flex justify-center">
              <Lock size={48} className="text-gray-600" />
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
