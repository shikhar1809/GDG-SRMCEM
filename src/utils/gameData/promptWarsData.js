// Prompt Wars challenge bank.
//
// These prompts use ICONIC, instantly recognisable scenes whose images are
// very predictable. Players should be able to guess the key words just by
// looking - no artistic ambiguity.
//
// Rules:
//   - Keep prompts CONCRETE and VISIBLE (every word must be in the picture).
//   - Easy: 2 obvious nouns + 1 strong colour. Anyone can identify them.
//   - Medium: 3 nouns, a scene rather than an isolated object.
//   - Hard: 4 content words, one of them slightly unusual.
//   - Avoid camera jargon (no "cinematic", "bokeh", "8k"), moods or styles.
//   - These IDs map to pre-fetched images in /game-images/prompt-wars/.

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
  // --- easy: 2 obvious nouns + 1 colour, universally recognisable ----------
  challenge('pw_e1', 'a red apple on a wooden table', 201, 'easy'),
  challenge('pw_e2', 'a yellow banana on a white plate', 202, 'easy'),
  challenge('pw_e3', 'a white cat on a blue sofa', 203, 'easy'),
  challenge('pw_e4', 'a orange sunset over the ocean', 204, 'easy'),
  challenge('pw_e5', 'a green tree on a small island', 205, 'easy'),
  challenge('pw_e6', 'a red rose on a wooden table', 206, 'easy'),
  challenge('pw_e7', 'a yellow taxi on a city street', 207, 'easy'),
  challenge('pw_e8', 'a white dog running on green grass', 208, 'easy'),

  // --- medium: 3 nouns, classic iconic scenes ------------------------------
  challenge('pw_m1', 'an astronaut floating in space with stars', 211, 'medium'),
  challenge('pw_m2', 'a lighthouse on a cliff by the ocean', 212, 'medium'),
  challenge('pw_m3', 'a robot watering flowers in a garden', 213, 'medium'),
  challenge('pw_m4', 'a hot air balloon over green mountains', 214, 'medium'),
  challenge('pw_m5', 'a wooden boat on a lake at sunset', 215, 'medium'),
  challenge('pw_m6', 'a panda sitting in a bamboo forest', 216, 'medium'),
  challenge('pw_m7', 'a train crossing a bridge over a river', 217, 'medium'),
  challenge('pw_m8', 'a castle on a hill under full moon', 218, 'medium'),

  // --- hard: 4 content words, one unusual twist ----------------------------
  challenge('pw_h1', 'a giant octopus holding a guitar in the ocean', 221, 'hard'),
  challenge('pw_h2', 'a penguin wearing sunglasses on a skateboard', 222, 'hard'),
  challenge('pw_h3', 'a library of books floating above the clouds', 223, 'hard'),
  challenge('pw_h4', 'a dragon made of glass in a desert', 224, 'hard'),
  challenge('pw_h5', 'a tiger drinking tea at a wooden table', 225, 'hard'),
  challenge('pw_h6', 'a melting clock on a rock by the sea', 226, 'hard'),
];
