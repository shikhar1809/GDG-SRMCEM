const fs = require('fs');
const path = require('path');

const generateAIEyeData = () => {
  const data = [];
  const realKeywords = ['nature', 'city', 'portrait', 'animal', 'architecture', 'food', 'ocean', 'mountain', 'car', 'vintage', 'technology', 'space', 'forest', 'desert', 'snow', 'flower', 'bird', 'dog', 'cat', 'coffee', 'book', 'guitar', 'laptop', 'bicycle', 'sunset'];
  const aiPrompts = ['cyberpunk city', 'steampunk robot', 'fantasy castle', 'alien landscape', 'dragon in sky', 'futuristic car', 'neon glowing tree', 'underwater city', 'space colony', 'magical forest', 'holographic interface', 'robot portrait', 'floating island', 'crystal cave', 'time machine', 'hacker desk', 'virtual reality', 'mech suit', 'synthwave sunset', 'cybernetic implant', 'AI glowing brain', 'digital matrix', 'hologram projector', 'futuristic weapon', 'neon signs rain'];

  // 25 Real
  realKeywords.forEach((kw, i) => {
    data.push({
      id: `real_${i}`,
      imageUrl: `https://images.unsplash.com/photo-${1500000000000 + i}?q=80&w=800&auto=format&fit=crop&query=${kw}`, 
      isAI: false
    });
  });
  // Note: Unsplash requires actual IDs, source.unsplash is deprecated. 
  // Let's use Picsum for guaranteed real images
  for(let i=0; i<25; i++) {
    data[i].imageUrl = `https://picsum.photos/seed/real${i}/800/800`;
  }

  // 25 AI
  aiPrompts.forEach((prompt, i) => {
    data.push({
      id: `ai_${i}`,
      imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=800&height=800&nologo=true`,
      isAI: true
    });
  });

  return `export const AI_EYE_IMAGES = ${JSON.stringify(data, null, 2)};\n`;
};

const generatePromptWarsData = () => {
  const prompts = [
    'A futuristic neon city skyline at night',
    'A serene lake surrounded by tall mountains at sunset',
    'Abstract liquid waves in vibrant blue and purple colors',
    'A cute robot planting a tree in a post apocalyptic world',
    'A cyberpunk street food vendor in Tokyo',
    'A majestic dragon flying over a medieval castle',
    'A cozy cabin in a snowy pine forest',
    'A highly detailed steampunk pocket watch',
    'An astronaut floating in space looking at earth',
    'A magical glowing mushroom in a dark forest',
    'A futuristic flying car over a glowing highway',
    'A hyperrealistic portrait of a cyborg woman',
    'A giant ancient tree with a door at the base',
    'A surreal floating island with waterfalls',
    'A synthwave grid with a retro sun',
    'A cyberpunk cat with glowing glasses',
    'A massive space station orbiting a red planet',
    'A glowing blue crystal cave',
    'A pirate ship sailing on a sea of stars',
    'A futuristic high speed train entering a tunnel',
    'A cute red panda wearing a tiny backpack',
    'An epic battle between a knight and a shadow monster',
    'A tranquil Japanese zen garden in autumn',
    'A glowing geometric portal in a desert',
    'A hyperrealistic mechanical owl',
    'A futuristic city floating in the clouds',
    'A dark fantasy knight with a glowing red sword',
    'A cute ghost reading a book',
    'A cyberpunk hacker room with glowing monitors',
    'A massive underwater city with glowing domes',
    'A beautiful stained glass window of a galaxy',
    'A steampunk airship flying through clouds',
    'A neon glowing jellyfish in deep water',
    'A futuristic motorcycle on a rainy street',
    'A cute monster eating a giant slice of pizza',
    'A glowing ethereal deer in a misty forest',
    'A surreal desert landscape with giant floating clocks',
    'A hyperrealistic eye reflecting a galaxy',
    'A futuristic soldier in heavy armor',
    'A glowing crystal sword stuck in a stone',
    'A beautiful mermaid sitting on a rock',
    'A massive mecha robot in a ruined city',
    'A cute baby dragon sleeping on a pile of gold',
    'A cyberpunk geisha with glowing tattoos',
    'A surreal staircase leading to the moon',
    'A futuristic greenhouse with glowing plants',
    'A dark fantasy wizard casting a spell',
    'A neon glowing geometric wolf',
    'A cyberpunk alleyway with rain and reflections',
    'A massive glowing tree of life in space'
  ];

  const data = prompts.map((p, i) => ({
    id: `pw_${i}`,
    roundName: `Round ${i+1}`,
    imageUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=800&height=800&nologo=true`,
    originalPrompt: p
  }));

  return `export const PROMPT_CHALLENGES = ${JSON.stringify(data, null, 2)};\n`;
};

const aiEyePath = path.join(__dirname, 'src', 'utils', 'gameData', 'aiEyeData.js');
const promptWarsPath = path.join(__dirname, 'src', 'utils', 'gameData', 'promptWarsData.js');

fs.mkdirSync(path.dirname(aiEyePath), { recursive: true });
fs.writeFileSync(aiEyePath, generateAIEyeData());
fs.writeFileSync(promptWarsPath, generatePromptWarsData());

console.log("Generated aiEyeData.js and promptWarsData.js");
