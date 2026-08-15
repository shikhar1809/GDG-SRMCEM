import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import GamesPanel from './pages/GamesPanel';
import MysteryHunt from './pages/MysteryHunt';
import TechRecall from './pages/TechRecall';
import PromptWars from './pages/PromptWars';
import AIEye from './pages/AIEye';
import TechQuiz from './pages/TechQuiz';
import GuessImpostor from './pages/GuessImpostor';
import AdminGames from './pages/AdminGames';
import ProtectedRoute from './components/ProtectedRoute';
import AppOverlay from './components/AppOverlay';

export default function App() {
  return (
    <Router>
      <AppOverlay />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/arcade" element={<ProtectedRoute><GamesPanel /></ProtectedRoute>} />
        <Route path="/mystery-hunt" element={<ProtectedRoute><MysteryHunt /></ProtectedRoute>} />
        <Route path="/arcade/words" element={<ProtectedRoute><TechRecall /></ProtectedRoute>} />
        <Route path="/arcade/promptwars" element={<ProtectedRoute><PromptWars /></ProtectedRoute>} />
        <Route path="/arcade/ai-eye" element={<ProtectedRoute><AIEye /></ProtectedRoute>} />
        <Route path="/arcade/tech-quiz" element={<ProtectedRoute><TechQuiz /></ProtectedRoute>} />
        <Route path="/arcade/impostor" element={<ProtectedRoute><GuessImpostor /></ProtectedRoute>} />
        <Route path="/admingames" element={<ProtectedRoute><AdminGames /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
