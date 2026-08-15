const fs = require('fs');
const path = require('path');

// 1. GuessImpostor
let guessImpostor = fs.readFileSync('src/pages/GuessImpostor.jsx', 'utf8');
guessImpostor = guessImpostor.replace(
  /const FALLBACK_QUESTIONS = \[\s*\{ category: 'Frontend Frameworks'.*?\];/s,
  `import { GUESS_IMPOSTOR_QUESTIONS as FALLBACK_QUESTIONS } from '../utils/gameData/guessImpostorData';`
);
fs.writeFileSync('src/pages/GuessImpostor.jsx', guessImpostor);

// 2. TechQuiz
let techQuiz = fs.readFileSync('src/pages/TechQuiz.jsx', 'utf8');
techQuiz = techQuiz.replace(
  /const FALLBACK_QUESTIONS = \[\s*\{ question: 'What year was Google founded\?'.*?\];/s,
  `import { TECH_QUIZ_QUESTIONS as FALLBACK_QUESTIONS } from '../utils/gameData/techQuizData';`
);
fs.writeFileSync('src/pages/TechQuiz.jsx', techQuiz);

// 3. TechRecall
let techRecall = fs.readFileSync('src/pages/TechRecall.jsx', 'utf8');
techRecall = techRecall.replace(
  /const FALLBACK_WORDS = \[\s*'REACT', 'FIREBASE',.*?\];/s,
  `import { TECH_RECALL_WORDS } from '../utils/gameData/techRecallData';\nconst FALLBACK_WORDS = TECH_RECALL_WORDS.map(w => w.word);`
);
fs.writeFileSync('src/pages/TechRecall.jsx', techRecall);

// 4. PromptWars
let promptWars = fs.readFileSync('src/pages/PromptWars.jsx', 'utf8');
promptWars = promptWars.replace(
  `import { PROMPT_CHALLENGES } from '../utils/gameChallenges';`,
  `import { PROMPT_CHALLENGES } from '../utils/gameData/promptWarsData';`
);
fs.writeFileSync('src/pages/PromptWars.jsx', promptWars);

// 5. AIEye
let aiEye = fs.readFileSync('src/pages/AIEye.jsx', 'utf8');
aiEye = aiEye.replace(
  /const FALLBACK_IMAGES = \[\s*\{ imageUrl: 'https:\/\/picsum\.photos.*?\];/s,
  `import { AI_EYE_IMAGES as FALLBACK_IMAGES } from '../utils/gameData/aiEyeData';`
);
fs.writeFileSync('src/pages/AIEye.jsx', aiEye);

console.log("Refactoring complete");
