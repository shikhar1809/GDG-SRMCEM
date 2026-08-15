const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'PromptWars.jsx');
let content = fs.readFileSync(file, 'utf8');

// I need to find the specific "Back to Arcade" button inside "Submitted!" block to cut the file there.
const splitPoint = `                  Back to Arcade
                </button>
              </motion.div>`;

const parts = content.split(splitPoint);
if (parts.length > 1) {
  // Keep the first part and the splitPoint itself
  const newContent = parts[0] + splitPoint + `
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

  fs.writeFileSync(file, newContent);
  console.log("Fixed PromptWars.jsx");
} else {
  console.log("Could not find the split point!");
}
