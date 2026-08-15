import React from 'react';
import { Trophy, Play } from 'lucide-react';
import { MAX_ATTEMPTS } from '../utils/useGameSession';

/**
 * The "visit our stall" card shown before a game starts.
 *
 * One component for all five games so the request/approval/attempts flow reads
 * and behaves identically everywhere - previously each game had its own copy
 * and they had drifted apart.
 */
export default function StallGate({ session, accent = '#4285F4', onStart }) {
  const { status, attemptsLeft, attemptsUsed, lobbyCode, requestToPlay, cancelRequest } = session;

  return (
    <div className="bg-gray-50/80 border border-gray-200 p-8 rounded-3xl max-w-lg w-full mx-auto shadow-2xl">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{ backgroundColor: `${accent}22`, color: accent }}
      >
        <Trophy size={32} />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3">Visit Our Stall to Play!</h3>
      <p className="text-gray-500 text-base leading-relaxed mb-6">
        To play this game and win exciting GDG swags, please visit our physical stall and request
        access. You get <strong>{MAX_ATTEMPTS} attempts</strong> — your best run counts.
      </p>

      {status === 'none' && (
        <button
          onClick={requestToPlay}
          className="w-full inline-flex justify-center items-center px-8 py-4 text-white font-bold rounded-xl text-lg transition-opacity hover:opacity-90 shadow-lg"
          style={{ backgroundColor: accent }}
        >
          Request to Play
        </button>
      )}

      {status === 'pending' && (
        <div className="flex flex-col gap-3">
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
            <span className="font-bold">Waiting for Admin Approval...</span>
          </div>
          <div className="text-center font-mono text-xl font-bold bg-gray-50 py-2 rounded-lg border border-gray-200">
            Lobby Code: <span style={{ color: accent }}>{lobbyCode || '...'}</span>
          </div>
        </div>
      )}

      {status === 'approved' && attemptsLeft > 0 && (
        <div className="flex flex-col gap-3">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl font-bold">
            {attemptsUsed === 0
              ? `Approved! ${attemptsLeft} attempts available.`
              : `Attempt ${attemptsUsed + 1} of ${MAX_ATTEMPTS} — ${attemptsLeft} left.`}
          </div>
          <button
            onClick={onStart}
            className="w-full inline-flex justify-center items-center px-8 py-4 bg-[#34A853] hover:bg-green-600 text-white font-bold rounded-xl text-lg transition-transform hover:scale-105 active:scale-95 shadow-lg"
          >
            <Play className="w-5 h-5 mr-2 fill-current" />
            {attemptsUsed === 0 ? 'Start Game' : `Start Attempt ${attemptsUsed + 1}`}
          </button>
        </div>
      )}

      {(status === 'completed' || attemptsLeft === 0) && status !== 'none' && status !== 'pending' && (
        <div className="bg-gray-100 text-gray-600 p-4 rounded-xl">
          <span className="font-bold block">All {MAX_ATTEMPTS} attempts used.</span>
          <span className="text-sm">Your best score is on the leaderboard. Try another game!</span>
        </div>
      )}

      {(status === 'pending' || (status === 'approved' && attemptsLeft > 0)) && (
        <button
          onClick={cancelRequest}
          className="w-full mt-4 inline-flex justify-center items-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
        >
          Cancel Request
        </button>
      )}
    </div>
  );
}
