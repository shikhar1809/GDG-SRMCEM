import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppOverlay from './components/AppOverlay';

const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));
const Home = lazy(() => import('./pages/Home'));
const GamesPanel = lazy(() => import('./pages/GamesPanel'));
const MysteryHunt = lazy(() => import('./pages/MysteryHunt'));
const TechRecall = lazy(() => import('./pages/TechRecall'));
const PromptWars = lazy(() => import('./pages/PromptWars'));
const AIEye = lazy(() => import('./pages/AIEye'));
const TechQuiz = lazy(() => import('./pages/TechQuiz'));
const GuessImpostor = lazy(() => import('./pages/GuessImpostor'));
const AdminGames = lazy(() => import('./pages/AdminGames'));
const MyBadges = lazy(() => import('./pages/MyBadges'));
const LeaderboardPreview = lazy(() => import('./pages/LeaderboardPreview'));
const TreasureHuntPreview = lazy(() => import('./pages/TreasureHuntPreview'));

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppOverlay />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/arcade" element={<ProtectedRoute><GamesPanel /></ProtectedRoute>} />
          <Route path="/mystery-hunt" element={<ProtectedRoute><MysteryHunt /></ProtectedRoute>} />
          <Route path="/arcade/words" element={<ProtectedRoute><TechRecall /></ProtectedRoute>} />
          <Route path="/arcade/promptwars" element={<ProtectedRoute><PromptWars /></ProtectedRoute>} />
          <Route path="/arcade/ai-eye" element={<ProtectedRoute><AIEye /></ProtectedRoute>} />
          <Route path="/arcade/tech-quiz" element={<ProtectedRoute><TechQuiz /></ProtectedRoute>} />
          <Route path="/arcade/impostor" element={<ProtectedRoute><GuessImpostor /></ProtectedRoute>} />
          <Route path="/credential/mybadges" element={<ProtectedRoute><MyBadges /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminGames /></ProtectedRoute>} />
          <Route path="/admingames" element={<ProtectedRoute><AdminGames /></ProtectedRoute>} />
          {/* Public display screens — no auth required */}
          <Route path="/leaderboardpreview" element={<LeaderboardPreview />} />
          <Route path="/treasurehuntpreview" element={<TreasureHuntPreview />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
