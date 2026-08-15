const fs = require('fs');
const path = require('path');

// 1. Rewrite promptWarsData.js with 50 simple objects
const generatePromptWarsData = () => {
  const prompts = [
    'A red apple', 'A blue car', 'A yellow sun', 'A green tree', 'A cute dog',
    'A fluffy cat', 'A slice of pizza', 'A cup of coffee', 'A wooden chair', 'A white clouds',
    'A beautiful butterfly', 'A flying bird', 'A swimming fish', 'A tall building', 'A fast train',
    'A clear window', 'A shiny star', 'A full moon', 'A green leaf', 'A colorful rainbow',
    'A red rose', 'A blue bicycle', 'A flying airplane', 'A sailing boat', 'A burning fire',
    'A cold ice cream', 'A yellow banana', 'A round ball', 'A reading book', 'A writing pen',
    'A ticking clock', 'A ringing phone', 'A warm blanket', 'A soft pillow', 'A bright lamp',
    'A running horse', 'A jumping frog', 'A crawling turtle', 'A flying bee', 'A busy ant',
    'A sharp knife', 'A round plate', 'A glass of water', 'A pair of shoes', 'A winter hat',
    'A warm jacket', 'A green frog', 'A pink pig', 'A brown bear', 'A gray elephant'
  ];

  const data = prompts.map((p, i) => ({
    id: `pw_${i}`,
    roundName: `Round ${i+1}`,
    imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=800&height=800&nologo=true`,
    originalPrompt: p
  }));

  return `export const PROMPT_CHALLENGES = ${JSON.stringify(data, null, 2)};\n`;
};

fs.writeFileSync(path.join(__dirname, 'src/utils/gameData/promptWarsData.js'), generatePromptWarsData());


// 2. Fix TechRecall.jsx
let techRecall = fs.readFileSync('src/pages/TechRecall.jsx', 'utf8');
techRecall = techRecall.replace('const FLASH_DURATION = 2000;', 'const FLASH_DURATION = 5000;');
techRecall = techRecall.replace('const PLAY_DURATION = 30;', 'const PLAY_DURATION = 60;');
techRecall = techRecall.replace(
  'onChange={e => setInputValue(e.target.value.toUpperCase())}', 
  'onChange={e => setInputValue(e.target.value)}'
);
techRecall = techRecall.replace(
  'if (inputValue.trim().toUpperCase() === currentWord) {', 
  'if (inputValue.trim().toLowerCase() === currentWord.toLowerCase()) {'
);
techRecall = techRecall.replace(
  'className="w-full bg-gray-50 border-2 border-[#4285F4] rounded-2xl px-6 py-5 text-2xl text-center text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#4285F4]/50 transition-all uppercase tracking-widest shadow-lg"',
  'className="w-full bg-gray-50 border-2 border-[#4285F4] rounded-2xl px-6 py-5 text-2xl text-center text-gray-900 focus:outline-none focus:ring-4 focus:ring-[#4285F4]/50 transition-all tracking-widest shadow-lg"'
);
fs.writeFileSync('src/pages/TechRecall.jsx', techRecall);


// 3. Fix updateArcadeScore.js
const updateArcadeScoreCode = `import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Updates a user's global arcade score.
 * Ensures only the HIGHEST score per game is kept, allowing replays.
 * 
 * @param {string} userId - The Firebase auth user ID
 * @param {string} userName - The user's display name
 * @param {string} userEmail - The user's email
 * @param {string} gameId - Unique ID for the game (e.g. 'prompt-wars', 'tech-quiz')
 * @param {number} points - Points to award (Max 100)
 * @returns {Promise<boolean>} - True if points were successfully awarded/updated.
 */
export const updateArcadeScore = async (userId, userName, userEmail, gameId, points) => {
  if (!userId) return false;
  
  const scoreRef = doc(db, 'arcadeScores', userId);
  const safePoints = Math.min(100, Math.max(0, Math.round(points))); // Cap points at 100
  
  try {
    const docSnap = await getDoc(scoreRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const oldScore = data[\`score_\${gameId}\`] || 0;
      
      // Only update if they beat their previous high score for this game
      if (safePoints > oldScore) {
        const diff = safePoints - oldScore;
        await updateDoc(scoreRef, {
          totalScore: increment(diff),
          [\`score_\${gameId}\`]: safePoints,
          [\`played_\${gameId}\`]: true,
          displayName: userName || data.displayName,
          email: userEmail || data.email,
          lastUpdated: serverTimestamp()
        });
        console.log(\`Successfully updated \${gameId} score from \${oldScore} to \${safePoints}. (+\${diff} total pts)\`);
        window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: diff, gameId } }));
        return true;
      } else {
        console.log(\`User scored \${safePoints} in \${gameId}, but previous best was \${oldScore}. Total score unchanged.\`);
        return false;
      }
    } else {
      // First time playing an arcade game
      await setDoc(scoreRef, {
        userId,
        displayName: userName || 'Anonymous',
        email: userEmail || 'No Email',
        totalScore: safePoints,
        [\`score_\${gameId}\`]: safePoints,
        [\`played_\${gameId}\`]: true,
        lastUpdated: serverTimestamp()
      });
      console.log(\`Successfully awarded \${safePoints} pts for \${gameId}.\`);
      window.dispatchEvent(new CustomEvent('arcadeScoreAdded', { detail: { points: safePoints, gameId } }));
      return true;
    }
  } catch (error) {
    console.error("Error updating arcade score:", error);
    return false;
  }
};
`;
fs.writeFileSync('src/utils/updateArcadeScore.js', updateArcadeScoreCode);

console.log("Applied all user requested fixes.");
