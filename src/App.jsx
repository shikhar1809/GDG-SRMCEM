import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AppOverlay from './components/AppOverlay';
import { ErrorBoundary } from './components/ErrorBoundary';
import ArcadeLock from './components/ArcadeLock';

const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'));
const Home = lazy(() => import('./pages/Home'));
const GamesPanel = lazy(() => import('./pages/GamesPanel'));
const MysteryHunt = lazy(() => import('./pages/MysteryHunt'));
const TechRecall = lazy(() => import('./pages/TechRecall'));
const PromptWars = lazy(() => import('./pages/PromptWars'));
const AIEye = lazy(() => import('./pages/AIEye'));
const TechQuiz = lazy(() => import('./pages/TechQuiz'));
const GuessImpostor = lazy(() => import('./pages/GuessImpostor'));
const GuessTheTrivia = lazy(() => import('./pages/GuessTheTrivia'));
const AdminGames = lazy(() => import('./pages/AdminGames'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const MyBadges = lazy(() => import('./pages/MyBadges'));
const LeaderboardPreview = lazy(() => import('./pages/LeaderboardPreview'));
const TreasureHuntPreview = lazy(() => import('./pages/TreasureHuntPreview'));
const CodeDisplay = lazy(() => import('./pages/CodeDisplay'));

import LoadingScreen from './components/LoadingScreen';

export default function App() {
  return (
    <Router>
      <AppOverlay />
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/arcade" element={<ProtectedRoute><ArcadeLock><GamesPanel /></ArcadeLock></ProtectedRoute>} />
          <Route path="/mystery-hunt" element={<ProtectedRoute><MysteryHunt /></ProtectedRoute>} />
          <Route path="/arcade/words" element={<ProtectedRoute><ArcadeLock><TechRecall /></ArcadeLock></ProtectedRoute>} />
          <Route path="/arcade/promptwars" element={<ProtectedRoute><ArcadeLock><PromptWars /></ArcadeLock></ProtectedRoute>} />
          <Route path="/arcade/ai-eye" element={<ProtectedRoute><ArcadeLock><AIEye /></ArcadeLock></ProtectedRoute>} />
          <Route path="/arcade/tech-quiz" element={<ProtectedRoute><ArcadeLock><TechQuiz /></ArcadeLock></ProtectedRoute>} />
          <Route path="/arcade/impostor" element={<ProtectedRoute><ArcadeLock><GuessImpostor /></ArcadeLock></ProtectedRoute>} />
          <Route path="/arcade/guess-trivia" element={
            <ErrorBoundary>
              <ProtectedRoute><ArcadeLock><GuessTheTrivia /></ArcadeLock></ProtectedRoute>
            </ErrorBoundary>
          } />
          <Route path="/credential/mybadges" element={<ProtectedRoute><MyBadges /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
          <Route path="/admingames" element={<ProtectedRoute><AdminGames /></ProtectedRoute>} />
          {/* Public display screens — no auth required */}
          <Route path="/leaderboardpreview" element={<LeaderboardPreview />} />
          <Route path="/treasurehuntpreview" element={<TreasureHuntPreview />} />
          {/* Code display pages — bold full-screen code */}
          <Route path="/GDGXL1" element={<CodeDisplay />} />
          <Route path="/GDGTT1" element={<CodeDisplay />} />
          <Route path="/GDGRP5" element={<CodeDisplay />} />
          <Route path="/GDGFR5" element={<CodeDisplay />} />
          <Route path="/GDGUS1" element={<CodeDisplay />} />
          <Route path="/GDGXZ1" element={<CodeDisplay />} />
          <Route path="/GDGMO6" element={<CodeDisplay />} />
          <Route path="/GDGHY3" element={<CodeDisplay />} />
          <Route path="/GDGKK9" element={<CodeDisplay />} />
          <Route path="/GDGCA6" element={<CodeDisplay />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
