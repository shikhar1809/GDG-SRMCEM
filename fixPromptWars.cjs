const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'pages', 'PromptWars.jsx');
let content = fs.readFileSync(file, 'utf8');

// I need to replace from:
//                 </motion.div>
//                         await setDoc(doc(db, 'gameRequests', reqId), {
//
// to the proper code.

const badCode = `                </motion.div>
                        await setDoc(doc(db, 'gameRequests', reqId), {`;

const goodCode = `                </motion.div>
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
                        await setDoc(doc(db, 'gameRequests', reqId), {`;

content = content.replace(badCode, goodCode);
fs.writeFileSync(file, content);
console.log("Fixed PromptWars.jsx");
