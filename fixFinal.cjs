const fs = require('fs');
const path = require('path');

// Fix GuessImpostor.jsx
const giPath = path.join(__dirname, 'src', 'pages', 'GuessImpostor.jsx');
let giContent = fs.readFileSync(giPath, 'utf8');
const dupCode = `                          timestamp: serverTimestamp()
                        });
                      }}
                          timestamp: serverTimestamp()
                        });
                      }}`;
const fixedDupCode = `                          timestamp: serverTimestamp()
                        });
                      }}`;
giContent = giContent.replace(dupCode, fixedDupCode);
fs.writeFileSync(giPath, giContent);
console.log("Fixed GuessImpostor.jsx");

// Fix PromptWars.jsx
const pwPath = path.join(__dirname, 'src', 'pages', 'PromptWars.jsx');
let pwContent = fs.readFileSync(pwPath, 'utf8');

// I will just find the correct end of handleSubmit and cut everything after,
// then append the correct render JSX.
const hsEnd = `      if (requestId) {
        try {
          await setDoc(doc(db, 'gameRequests', requestId), { status: 'completed' }, { merge: true });
        } catch(e) {}
      }
    } catch (err) {
      console.error('Error submitting guess:', err);
      setError('Failed to submit guess. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };`;

const parts = pwContent.split(hsEnd);
if (parts.length > 0) {
  const newPwContent = parts[0] + hsEnd + `

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center p-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Clock className="w-12 h-12 text-purple-500 mb-4" />
        </motion.div>
        <p className="text-xl font-medium animate-pulse text-gray-600">Loading active round...</p>
      </div>
    );
  }

  if (!activeRound || !activeRound.isActive) {
    return (
      <div className="min-h-screen bg-white text-gray-900 p-4 flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[100px] pointer-events-none" />
        <button
          onClick={() => navigate('/arcade')}
          className="absolute top-6 left-6 p-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-600 transition-colors z-10"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center z-10"
        >
          <Clock className="w-20 h-20 text-gray-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold mb-4 bg-clip-text text-transparent bg-[#4285F4]">
            No Active Round
          </h2>
          <p className="text-gray-500 text-lg max-w-md mx-auto">
            There is no active round right now. Check back later!
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 md:p-8 relative overflow-x-hidden">
      <div className="relative z-10 flex items-center justify-between mb-8 max-w-4xl mx-auto">
        <button
          onClick={() => navigate('/arcade')}
          className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-gray-600 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="text-center">
          <h1 className="text-2xl md:text-3xl font-black italic tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-purple-700 via-blue-700 to-purple-700 uppercase">
            Prompt Wars
          </h1>
          {(isAdmin || requestStatus === 'approved') && (
            <p className="text-sm text-gray-600 font-medium">{activeRound.roundName}</p>
          )}
        </div>
        <div className="w-10"></div>
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        <div className={\`grid grid-cols-1 \${(!isAdmin && requestStatus !== 'approved') ? '' : 'lg:grid-cols-2'} gap-8\`}>
          
          {(!isAdmin && requestStatus !== 'approved') ? null : (
            <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-4"
          >
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-2 shadow-xl shadow-purple-900/10 group overflow-hidden">
              <div className="relative rounded-xl overflow-hidden aspect-square bg-white flex items-center justify-center">
                {activeRound.imageUrl ? (
                  <img 
                    src={activeRound.imageUrl} 
                    alt="AI Generated Subject" 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <ImageIcon className="w-16 h-16 text-gray-700" />
                )}
                
                <div className="absolute inset-0 border border-white/10 rounded-xl pointer-events-none" />
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
              <p>
                Study the image above carefully. Try to guess the exact prompt used to generate it. The closest match wins!
              </p>
            </div>
          </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col justify-center"
          >
            {hasSubmitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-50 border border-green-500/30 rounded-2xl p-8 text-center shadow-lg"
              >
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2 text-gray-900">Submitted!</h3>
                <p className="text-gray-500 mb-2">
                  Your guess has been recorded. The admin will judge the closest prompt when the round ends.
                </p>
                {matchScore !== null && (
                  <div className="bg-purple-50 text-purple-700 font-bold py-3 px-4 rounded-xl inline-block mb-6 border border-purple-200 shadow-sm">
                    AI Semantic Match: {matchScore}% Accuracy
                  </div>
                )}
                <br />
                <button
                  onClick={() => navigate('/arcade')}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium transition-colors w-full sm:w-auto mt-2 border border-gray-200"
                >
                  Back to Arcade
                </button>
              </motion.div>
            ) : (!isAdmin && requestStatus !== 'approved') ? (
              <div className="bg-gray-50/80 border border-gray-200 p-8 rounded-3xl w-full text-center">
                <div className="bg-purple-500/20 text-[#c084fc] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trophy size={32} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">Prompt Wars</h3>
                <p className="text-gray-600 text-base leading-relaxed mb-4">
                  In this game, you'll be shown an AI-generated image. Your challenge is to guess the exact prompt used to generate it. The closer your guess is to the original prompt, the higher your semantic match score!
                </p>
                <div className="bg-purple-100 text-purple-800 p-4 rounded-xl mb-6">
                  <p className="font-semibold text-sm">
                    To play this game and win exciting GDG swags, please visit our physical stall and request access.
                  </p>
                </div>
                
                {requestStatus === 'none' && (
                  <button 
                    onClick={async () => {
                      if (!auth.currentUser) return;
                      const reqId = \`\${auth.currentUser.uid}_prompt-wars\`;
                      await setDoc(doc(db, 'gameRequests', reqId), {
                        userId: auth.currentUser.uid,
                        userName: auth.currentUser.displayName || 'Player',
                        userEmail: auth.currentUser.email,
                        gameId: 'prompt-wars',
                        status: 'pending',
                        lobbyCode: Math.floor(100 + Math.random() * 900).toString(),
                        timestamp: serverTimestamp()
                      });
                    }}
                    className="w-full inline-flex justify-center items-center px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-xl text-lg transition-colors shadow-lg mb-4"
                  >
                    Request to Play
                  </button>
                )}
                
                {requestStatus === 'pending' && (
                  <div className="flex flex-col gap-3 mb-4">
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl flex items-center justify-center gap-3">
                      <div className="w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="font-bold">Waiting for Admin Approval...</span>
                    </div>
                    <div className="text-center font-mono text-xl font-bold bg-gray-50 py-2 rounded-lg border border-gray-200">
                      Lobby Code: <span className="text-purple-600">{lobbyCode || '...'}</span>
                    </div>
                  </div>
                )}

                <button 
                  onClick={async () => {
                    if (!requestId) return;
                    try {
                      await deleteDoc(doc(db, 'gameRequests', requestId));
                    } catch(e) {}
                  }}
                  className="w-full inline-flex justify-center items-center px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors"
                >
                  Cancel Request
                </button>
              </div>
            ) : (
              <div className="bg-gray-50/80 border border-gray-200 p-6 md:p-8 rounded-3xl shadow-xl shadow-purple-900/10">
                <div className="mb-6">
                  <label htmlFor="promptGuess" className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">
                    Your Prompt
                  </label>
                  <div className="relative">
                    <textarea
                      id="promptGuess"
                      value={promptGuess}
                      onChange={(e) => setPromptGuess(e.target.value)}
                      placeholder="A cinematic shot of..."
                      className="w-full bg-white border border-gray-200 rounded-xl p-4 min-h-[160px] text-gray-900 placeholder-gray-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
                      maxLength={500}
                    />
                    <div className="absolute bottom-4 right-4 text-xs text-gray-500 font-medium">
                      {promptGuess.length}/500
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !promptGuess.trim()}
                    className="w-full bg-[#4285F4] hover:bg-blue-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20 py-4"
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        Submit Guess <Send className="w-5 h-5" />
                      </>
                    )}
                  </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default PromptWars;
`;
  fs.writeFileSync(pwPath, newPwContent);
  console.log("Fixed PromptWars.jsx");
}
