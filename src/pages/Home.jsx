import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code2, Globe as GlobeIcon, Rocket, Users, Target, MessageSquare, X, Compass, Calendar, Award } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import TextLoop from '../components/TextLoop';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Globe } from '../components/ui/globe';

const TEAM = [
  { name: 'Priyam Srivastava', role: 'Organizer (Lead)' },
  { name: 'Navleen Kaur', role: 'Co-Organizer' },
  { name: 'Lav Kumar Shakya', role: 'Technical Head' },
  { name: 'Bhanu Pratap Singh', role: 'Marketing Head' },
  { name: 'Ayush Pandey', role: 'Creative Head' },
  { name: 'Kirti .', role: 'Event and PR Head' },
  { name: 'Ananay Verma', role: 'Social Media Head' },
];

import LogoLoop from '../components/LogoLoop';
import { SiFirebase, SiGooglecloud, SiFlutter, SiAndroid, SiTensorflow, SiAngular, SiGoogle } from 'react-icons/si';

const techLogos = [
  { node: <SiFirebase className="text-[#FFCA28]" />, title: "Firebase", href: "https://firebase.google.com" },
  { node: <SiGooglecloud className="text-[#4285F4]" />, title: "Google Cloud", href: "https://cloud.google.com" },
  { node: <SiFlutter className="text-[#02569B]" />, title: "Flutter", href: "https://flutter.dev" },
  { node: <SiAndroid className="text-[#3DDC84]" />, title: "Android", href: "https://developer.android.com" },
  { node: <SiTensorflow className="text-[#FF6F00]" />, title: "TensorFlow", href: "https://www.tensorflow.org" },
  { node: <SiAngular className="text-[#DD0031]" />, title: "Angular", href: "https://angular.io" },
  { node: <SiGoogle className="text-[#4285F4]" />, title: "Gemini", href: "https://gemini.google.com" },
];

export default function Home() {
  const navigate = useNavigate();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);
  const [arcadeEnabled, setArcadeEnabled] = useState(false);
  const [eventsCatalog, setEventsCatalog] = useState([]);
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.defaultMuted = true;
      videoRef.current.muted = true;
      videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
    }
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'huntConfig', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setArcadeEnabled(data.arcadeEnabled === true);
        setEventsCatalog(data.eventsCatalog || []);
      }
    });
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-white selection:bg-[#4285F4]/20">
      {/* Navigation */}
      <nav className="sticky top-0 w-full z-50 px-4 md:px-6 py-3 md:py-4 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-gray-100 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2 md:gap-3 flex-1">
          <img 
            src="/gdg_logo.png" 
            alt="GDG Logo" 
            className="w-7 h-7 md:w-8 md:h-8 object-contain"
          />
          <span className="font-semibold text-gray-800 text-lg md:text-xl tracking-tight hidden sm:block">GDG SRMCEM</span>
        </div>

        {/* Flashing GDG Arcade Button */}
        <div className="flex justify-center flex-[1.5] md:flex-1">
          {arcadeEnabled && (
            <motion.button
              onClick={() => navigate('/arcade')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative group rounded-full p-[2px] md:p-[3px] overflow-hidden shadow-[0_0_10px_rgba(66,133,244,0.15)] hover:shadow-[0_0_15px_rgba(66,133,244,0.3)] transition-all duration-300"
          >
            {/* Rotating gradient border */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              style={{ willChange: 'transform' }}
              className="absolute inset-[-100%] bg-[conic-gradient(from_90deg_at_50%_50%,#AECBFA_0%,#F4B4AE_25%,#FDE293_50%,#A8DAB5_75%,#AECBFA_100%)] opacity-60"
            />
            {/* Inner button */}
            <div className="relative flex items-center gap-1.5 md:gap-2 bg-white px-3 md:px-6 py-1.5 md:py-2 rounded-full font-black text-[10px] md:text-sm tracking-widest uppercase hover:bg-gray-50 transition-colors w-full justify-center">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                style={{ willChange: 'transform' }}
                className="text-[#4285F4]"
              >
                <Compass size={18} className="md:w-5 md:h-5" />
              </motion.div>
              <span className="bg-gradient-to-r from-[#4285F4] via-[#ea4335] to-[#fbbc04] bg-clip-text text-transparent drop-shadow-sm whitespace-nowrap">
                GDG<span className="hidden sm:inline"> ARCADE</span>
              </span>
            </div>
          </motion.button>
          )}
        </div>

        <div className="flex justify-end flex-1 items-center gap-2 md:gap-3">
          
          {/* Event Catalog Button (Nav) */}
          <motion.button
            onClick={() => setShowEventsModal(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2.5 bg-white border border-gray-200 rounded-full shadow-sm hover:border-blue-200 hover:shadow-md transition-all duration-300"
          >
            <motion.div
              animate={{ rotate: [-8, 8, -8] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="text-[#4285F4]"
            >
              <Calendar size={16} strokeWidth={2.5} className="md:w-5 md:h-5" />
            </motion.div>
            <span className="font-semibold text-gray-800 text-xs md:text-sm hidden lg:inline">Event Catalog</span>
            <span className="font-semibold text-gray-800 text-xs md:text-sm lg:hidden hidden sm:inline">Events</span>
          </motion.button>

          {/* My Badges Button (Nav) */}
          <Link to="/credential/mybadges">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative overflow-hidden flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2.5 bg-[#FFF8E1] border border-[#FFE082] rounded-full shadow-sm hover:shadow-md transition-all duration-300 group"
            >
              {/* Golden Badge Icon (Non-generic) */}
              <div className="relative flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-sm md:w-5 md:h-5">
                  <path d="M12 1L15.09 7.26L22 8.27L17 13.14L18.18 20.02L12 16.77L5.82 20.02L7 13.14L2 8.27L8.91 7.26L12 1Z" fill="url(#goldGradNav)" stroke="#F59E0B" strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="12" cy="12" r="3.5" fill="#FFFBEB" opacity="0.9"/>
                  <defs>
                    <linearGradient id="goldGradNav" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#FDE047" />
                      <stop offset="0.5" stopColor="#F59E0B" />
                      <stop offset="1" stopColor="#D97706" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <span className="font-semibold text-[#D97706] text-xs md:text-sm hidden sm:inline whitespace-nowrap">My Badges</span>
              
              {/* Periodic Shine Overlay */}
              <motion.div
                animate={{ x: ["-150%", "200%", "200%"] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
                className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-transparent via-white/60 to-transparent skew-x-[-20deg]"
              />
            </motion.button>
          </Link>

          <button 
            onClick={() => setShowJoinModal(true)}
            className="bg-[#4285F4] hover:bg-[#3367d6] text-white px-4 md:px-6 py-1.5 md:py-2.5 rounded-full font-medium transition-colors shadow-sm shadow-blue-200 text-xs md:text-sm whitespace-nowrap"
          >
            Join <span className="hidden sm:inline">Chapter</span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-0 pb-16 md:pb-12 px-0 md:px-6 overflow-hidden">
        <style>{`
          video::-webkit-media-controls { display: none !important; }
          video::-webkit-media-controls-start-playback-button { display: none !important; }
          video::-webkit-media-controls-overlay-play-button { display: none !important; }
          video::-webkit-media-controls-panel { display: none !important; }
          video::-webkit-media-controls-play-button { display: none !important; }
        `}</style>
        {/* Subtle Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] md:w-[800px] h-[300px] md:h-[400px] opacity-50 rounded-[100%] -z-10" style={{ background: 'radial-gradient(ellipse, #e8f0fe 0%, #fce8e6 70%, rgba(255,255,255,0) 100%)' }} />
        
        <div className="w-full md:max-w-7xl mx-auto text-center flex justify-center bg-transparent rounded-b-3xl md:rounded-none">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full flex flex-col items-center"
          >
            <video 
              ref={videoRef}
              src="/home_banner.mp4"
              poster="/hero.png"
              autoPlay 
              loop 
              muted 
              playsInline
              disablePictureInPicture
              disableRemotePlayback
              preload="auto"
              className="w-full h-[40vh] sm:h-[50vh] md:h-auto max-h-[70vh] md:max-h-[80vh] object-contain md:rounded-3xl shadow-sm pointer-events-none"
              style={{ backgroundColor: 'transparent' }}
            />
          </motion.div>
        </div>
      </section>

      {/* Global Network Section */}
      <section className="py-12 md:py-20 px-4 md:px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12">
          {/* Left Side: GDG Logo & Globe */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="flex-1 flex flex-col items-center justify-center gap-4 md:gap-6"
          >

            <div className="flex flex-col items-center text-center">
              <div className="bg-white rounded-full p-4 mb-4 border border-gray-100 shadow-sm w-40 h-40 flex items-center justify-center relative">
                <Globe />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 leading-tight">
                Amplify Your <br/>
                <span className="text-[#4285F4]">Global Reach</span>
              </h3>
            </div>
          </motion.div>

          {/* Right Side: Global Network Map */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex-[2] w-full"
          >
            <img 
              src="/global_network.jpg" 
              alt="Global Network Map" 
              className="w-full h-auto rounded-3xl shadow-lg border border-gray-100 object-cover"
            />
          </motion.div>
        </div>
      </section>

      {/* Text Loop Section (Separator) */}
      <section className="w-full bg-white overflow-hidden py-4 border-y border-gray-100 flex items-center justify-center">
        <TextLoop
          text="GDG ✦ SRMCEM"
          shape="wave"
          speed={90}
          direction="forward"
          separator="✦"
          curviness={40}
          fontSize={24}
          fontWeight={700}
          letterSpacing={2}
          uppercase
          color="#9CA3AF"
          ribbon
          ribbonColor="#E8F0FE"
          ribbonWidth={30}
          pauseOnHover={false}
        />
      </section>

      {/* What to Expect (Bento Grid) */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-gray-50/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">What to Expect</h2>
            <p className="text-base md:text-lg text-gray-500 max-w-2xl mx-auto px-2">Join a thriving community dedicated to innovation, learning, and building real-world solutions.</p>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 auto-rows-[auto] md:auto-rows-[250px]">
            
            {/* Box 1 (Large) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }}
              className="md:col-span-2 bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
            >
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-50 group-hover:scale-110 transition duration-700 -z-10" style={{ background: 'radial-gradient(circle, #e8f0fe 0%, rgba(232,240,254,0) 70%)' }} />
              <Code2 className="text-[#4285F4] mb-6" size={40} />
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Workshops & Codelabs</h3>
              <p className="text-gray-500 max-w-md leading-relaxed">Get hands-on experience with Android, Web, Cloud, and Machine Learning through guided, practical sessions led by experts.</p>
            </motion.div>

            {/* Box 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: 0.1 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
            >
              <div className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full opacity-50 group-hover:scale-110 transition duration-700 -z-10" style={{ background: 'radial-gradient(circle, #fce8e6 0%, rgba(252,232,230,0) 70%)' }} />
              <GlobeIcon className="text-[#EA4335] mb-4 md:mb-6" size={32} />
              <h3 className="text-xl font-bold text-gray-900 mb-2 md:mb-3">Global Network</h3>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed">Connect with millions of developers across the globe.</p>
            </motion.div>

            {/* Box 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: 0.2 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
            >
              <div className="absolute top-0 left-0 w-32 h-32 rounded-full opacity-50 group-hover:scale-110 transition duration-700 -z-10" style={{ background: 'radial-gradient(circle, #fef7e0 0%, rgba(254,247,224,0) 70%)' }} />
              <Target className="text-[#FBBC04] mb-4 md:mb-6" size={32} />
              <h3 className="text-xl font-bold text-gray-900 mb-2 md:mb-3">Mentorship</h3>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed">Get guidance from experienced seniors and industry professionals.</p>
            </motion.div>

            {/* Box 4 (Large) */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: 0.3 }}
              className="md:col-span-2 bg-[#34A853] text-white rounded-[2rem] p-6 md:p-8 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow"
            >
              <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full opacity-10 group-hover:scale-110 transition duration-700 z-0" style={{ background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)' }} />
              <div className="relative z-10">
                <Rocket className="text-white mb-6" size={40} />
                <h3 className="text-2xl font-bold mb-3">Hackathons & Projects</h3>
                <p className="text-green-50 max-w-md leading-relaxed">Build real-world solutions collaboratively. Form teams, solve local problems, and participate in global Google Developer challenges.</p>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Stay Ahead Section */}
      <section className="w-full bg-white py-12 md:py-16 border-t border-gray-100 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 md:gap-12 bg-gray-50 rounded-[2rem] p-8 md:p-12 border border-gray-100 shadow-sm">
            <div className="w-full md:w-1/2 text-center md:text-left">
              <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Stay Ahead with Google
              </h2>
              <p className="text-gray-600 text-lg md:text-xl leading-relaxed">
                Discover the latest tools, connect with a global community, and shape the future of technology with us.
              </p>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <img 
                src="/athelete_run.png" 
                alt="Stay Ahead with Google" 
                className="max-w-full h-auto rounded-[2rem] shadow-md hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Technology Partners Loop */}
      <section className="w-full bg-white py-12 md:py-16 border-t border-gray-100 overflow-hidden">
        <div className="max-w-6xl mx-auto mb-8 text-center px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Powered by Google Technologies</h2>
        </div>
        <div style={{ height: '100px', position: 'relative', overflow: 'hidden'}}>
          <LogoLoop
            logos={techLogos}
            speed={100}
            direction="left"
            logoHeight={60}
            gap={60}
            pauseOnHover={false}
            scaleOnHover
            fadeOut
            fadeOutColor="#ffffff"
            ariaLabel="Technology partners"
          />
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 md:py-24 px-4 md:px-6 bg-white border-t border-gray-100" id="team">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 md:mb-4">Meet the Team</h2>
            <p className="text-base md:text-lg text-gray-500">The passionate organizers leading GDG SRMCEM.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
            {TEAM.map((member, idx) => (
              <motion.div 
                key={member.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.05 }}
                viewport={{ once: true, margin: "-50px" }}
                className="flex flex-col items-center group cursor-pointer"
              >
                {/* Photo Placeholder */}
                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full mb-4 md:mb-5 bg-gray-100 overflow-hidden shadow-sm ring-4 ring-white border border-gray-100 group-hover:border-gray-300 group-hover:shadow-md group-hover:-translate-y-1 transition-all duration-300">
                   <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gradient-to-br from-gray-50 to-gray-200">
                     <Users size={24} className="md:w-8 md:h-8" />
                   </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 text-center">{member.name}</h3>
                <p className="text-sm font-medium text-[#4285F4] text-center mt-1">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative bg-white border-t border-gray-200 py-8 md:py-10 px-6 text-center overflow-hidden flex flex-col justify-center">
        {/* Background Image Overlay */}
        <div 
          className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat"
          style={{ backgroundImage: 'url("/footer.jpg")' }}
        />
        
        <div className="max-w-6xl mx-auto flex flex-col items-center relative z-10 w-full mt-2">
          <div className="bg-white/95 p-5 md:px-10 rounded-2xl border-[3px] border-gray-800 shadow-md flex flex-col items-center">
            <img 
              src="/gdg_logo.png" 
              alt="GDG Logo" 
              className="w-10 h-10 object-contain mb-3"
            />
            <p className="text-gray-900 font-bold text-lg md:text-xl">Google Developer Groups on Campus</p>
            <p className="text-[#4285F4] font-black tracking-wide mt-1">SRMCEM</p>
            <p className="text-gray-600 text-xs mt-3 font-semibold">© {new Date().getFullYear()} All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Join Chapter Modal */}
      <AnimatePresence>
        {showJoinModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-sm shadow-2xl relative"
            >
              <button 
                onClick={() => setShowJoinModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-[#e8f0fe] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Rocket className="text-[#4285F4]" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Join Our Chapter</h2>
                <p className="text-gray-500 text-sm">Connect with us on our official platforms to stay updated!</p>
              </div>

              <div className="flex flex-col gap-3">
                <a 
                  href="https://www.linkedin.com/company/gdgoncampus-srmcem/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                >
                  <div className="bg-[#0077b5]/10 p-2 rounded-lg group-hover:bg-[#0077b5] transition-colors">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[#0077b5] group-hover:text-white transition-colors">
                      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                      <rect x="2" y="9" width="4" height="12"></rect>
                      <circle cx="4" cy="4" r="2"></circle>
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-700 group-hover:text-blue-600">LinkedIn</span>
                </a>

                <a 
                  href="https://www.instagram.com/gdg_on_campus_srmcem/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-pink-500 hover:bg-pink-50 transition-all group"
                >
                  <div className="bg-[#E1306C]/10 p-2 rounded-lg group-hover:bg-gradient-to-tr group-hover:from-[#F56040] group-hover:to-[#E1306C] transition-colors">
                    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-[#E1306C] group-hover:text-white transition-colors">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                    </svg>
                  </div>
                  <span className="font-semibold text-gray-700 group-hover:text-pink-600">Instagram</span>
                </a>

                <a 
                  href="https://discord.gg/2SRjdZda4p" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
                >
                  <div className="bg-[#5865F2]/10 p-2 rounded-lg group-hover:bg-[#5865F2] transition-colors">
                    <MessageSquare size={24} className="text-[#5865F2] group-hover:text-white transition-colors" />
                  </div>
                  <span className="font-semibold text-gray-700 group-hover:text-indigo-600">Discord</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}

        {/* Event Catalog Modal */}
        {showEventsModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-[2rem] p-6 md:p-8 w-full max-w-lg shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              <button 
                onClick={() => setShowEventsModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-6 shrink-0">
                <div className="w-16 h-16 bg-[#e8f0fe] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="text-[#4285F4]" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Catalog</h2>
                <p className="text-gray-500 text-sm">Upcoming events from GDG SRMCEM</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 pb-2 space-y-4">
                {eventsCatalog.length > 0 ? (
                  eventsCatalog.map((event) => (
                    <div key={event.id} className="bg-gray-50 border border-gray-100 p-5 rounded-2xl flex flex-col gap-3">
                      {event.imageLink && (
                        <div className="w-full aspect-video rounded-xl overflow-hidden mb-1 bg-gray-200">
                          <img src={event.imageLink} alt={event.title} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-lg text-gray-900 leading-tight">{event.title}</h3>
                        <p className="text-sm font-medium text-gray-500 mt-1">{event.date}</p>
                      </div>
                      {event.link && (
                        <a 
                          href={event.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center bg-[#4285F4] hover:bg-[#3367d6] text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm self-start"
                        >
                          Details &amp; Registration
                        </a>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 px-4 bg-gray-50 rounded-2xl border border-gray-100 border-dashed">
                    <p className="text-gray-500 font-medium">No upcoming events listed at the moment.</p>
                    <p className="text-sm text-gray-400 mt-2">Check back soon or join our community for updates!</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
