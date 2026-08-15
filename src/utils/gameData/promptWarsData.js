// Prompt Wars challenge bank.
//
// The old prompts were two content words ("A red apple") scored with raw
// Jaccard including stopwords, so a perfect answer capped out around 66%.
// These are pitched at 3-4 content words: enough that partial credit is
// meaningful, few enough that a player can plausibly name all of them in 40s.
//
// Keep prompts CONCRETE and VISIBLE. Every scored word must be something the
// player can literally see in the picture - no moods, no camera jargon, or the
// game becomes unguessable again.

const challenge = (id, prompt, seed, difficulty) => ({
  id,
  prompt,
  difficulty,
  src: `/game-images/prompt-wars/${id}.jpg`,
  // Kept so the set can be regenerated with scripts/fetchGameImages.mjs
  remoteUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?width=768&height=768&nologo=true&seed=${seed}`,
});

export const PROMPT_CHALLENGES = [
  // --- easy: 2-3 obvious nouns, one strong colour --------------------------
  challenge('pw_e1', 'a red apple on a wooden table', 201, 'easy'),
  challenge('pw_e2', 'a yellow taxi on a rainy street', 202, 'easy'),
  challenge('pw_e3', 'a white cat sleeping on a blue sofa', 203, 'easy'),
  challenge('pw_e4', 'a slice of pizza on a paper plate', 204, 'easy'),
  challenge('pw_e5', 'a green tree on a small island', 205, 'easy'),
  challenge('pw_e6', 'a black umbrella in heavy rain', 206, 'easy'),
  challenge('pw_e7', 'a red bicycle against a brick wall', 207, 'easy'),
  challenge('pw_e8', 'a cup of coffee beside an open book', 208, 'easy'),

  // --- medium: 3-4 nouns, a scene rather than an object ---------------------
  challenge('pw_m1', 'an astronaut riding a horse on the moon', 211, 'medium'),
  challenge('pw_m2', 'a lighthouse on a cliff during a storm', 212, 'medium'),
  challenge('pw_m3', 'a robot watering flowers in a garden', 213, 'medium'),
  challenge('pw_m4', 'a hot air balloon over a snowy mountain', 214, 'medium'),
  challenge('pw_m5', 'a wooden boat on a lake at sunset', 215, 'medium'),
  challenge('pw_m6', 'a panda eating noodles with chopsticks', 216, 'medium'),
  challenge('pw_m7', 'a train crossing a bridge over a river', 217, 'medium'),
  challenge('pw_m8', 'a castle on a hill under a full moon', 218, 'medium'),

  // --- hard: 4 content words, one of them unusual --------------------------
  challenge('pw_h1', 'a giant octopus holding a neon guitar', 221, 'hard'),
  challenge('pw_h2', 'a penguin wearing sunglasses on a skateboard', 222, 'hard'),
  challenge('pw_h3', 'a floating library of books above the clouds', 223, 'hard'),
  challenge('pw_h4', 'a dragon made of glass in a desert', 224, 'hard'),
  challenge('pw_h5', 'a tiger drinking tea in a bamboo forest', 225, 'hard'),
  challenge('pw_h6', 'a clock melting on a rock in the snow', 226, 'hard'),
];
