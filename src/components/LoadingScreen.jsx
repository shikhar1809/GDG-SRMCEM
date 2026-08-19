import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen({ text = "Loading..." }) {
  return (
    <div className="min-h-screen fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 100 }}
        className="relative flex items-center justify-center w-32 h-32"
      >
        {/* Glow */}
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          className="absolute inset-0 bg-[#4285F4] rounded-full filter blur-2xl -z-10"
        />
        
        {/* Spinning Google Colors Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          className="absolute inset-0 border-[4px] border-transparent border-t-[#4285F4] border-r-[#EA4335] border-b-[#FBBC04] border-l-[#34A853] rounded-full"
        />

        {/* Pulsing Logo */}
        <motion.img
          src="/gdg_logo.png"
          alt="GDG Loading"
          animate={{ scale: [0.9, 1.05, 0.9] }}
          transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
          className="w-16 h-16 object-contain"
        />
      </motion.div>
      <motion.p 
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        className="mt-6 text-gray-500 font-black uppercase tracking-[0.2em] text-sm"
      >
        {text}
      </motion.p>
    </div>
  );
}
