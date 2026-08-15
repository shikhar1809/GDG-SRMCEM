// AI Eye image bank.
//
// The old set was unplayable as a *test*: the AI half was dragons, fantasy
// castles and steampunk robots, so the answer was "is this thing real in real
// life", not "does this photo look generated". Every player scored ~100.
//
// These prompts are deliberately photorealistic and mundane - the kind of shot
// a phone camera would produce - so the player has to look for the actual
// tells (hands, text, teeth, repeated texture, plastic skin, bent geometry).
//
// The game draws a guaranteed 50/50 real/AI split (see AIEye.jsx) so nobody can
// pattern-match "it's been three AI in a row, this one must be real".

const ai = (id, prompt, seed) => ({
  id,
  isAI: true,
  src: `/game-images/ai-eye/${id}.jpg`,
  // Kept so the set can be regenerated with scripts/fetchGameImages.mjs
  remoteUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(
    `${prompt}, photorealistic, shot on 35mm film, natural lighting, candid, high detail`
  )}?width=768&height=768&nologo=true&seed=${seed}`,
});

const real = (id, seed) => ({
  id,
  isAI: false,
  src: `/game-images/ai-eye/${id}.jpg`,
  remoteUrl: `https://picsum.photos/seed/${seed}/768/768`,
});

export const AI_EYE_IMAGES = [
  // --- AI generated, photorealistic ----------------------------------------
  //
  // These deliberately MIRROR the subject range of the real photos below
  // (landscape, coastline, architecture, objects, distant figures). An earlier
  // pass used portraits and food, and it broke the game: the real set from
  // picsum contains no people and no food, so "there is a person in it" was a
  // perfect tell and a player could score 10/10 without ever judging an image.
  // Subject must carry no signal - only rendering quality should.
  ai('ai_01', 'aerial view of a rocky coastline with turquoise water', 101),
  ai('ai_02', 'misty pine forest on a steep mountain slope', 102),
  ai('ai_03', 'city skyline at dusk under heavy clouds', 103),
  ai('ai_04', 'ocean waves seen from directly above', 104),
  ai('ai_05', 'a modern concrete building against an empty sky', 105),
  ai('ai_06', 'a wooden pier stretching over a calm lake', 106),
  ai('ai_07', 'snowy mountain range at sunrise', 107),
  ai('ai_08', 'flat lay of disassembled camera parts on a white surface', 108),
  ai('ai_09', 'an empty road through a desert at golden hour', 109),
  ai('ai_10', 'an old weathered fishing boat on a shore', 110),
  ai('ai_11', 'rooftops of an old european town in fog', 111),
  ai('ai_12', 'a single bare tree in an open field', 112),
  ai('ai_13', 'a weathered apartment building facade with many windows', 113),
  ai('ai_14', 'a narrow canyon with light falling between rock walls', 114),
  ai('ai_15', 'a small boat on a still green lake seen from far away', 115),

  // --- real photographs ------------------------------------------------------
  real('real_01', 'gdgreal01'),
  real('real_02', 'gdgreal02'),
  real('real_03', 'gdgreal03'),
  real('real_04', 'gdgreal04'),
  real('real_05', 'gdgreal05'),
  real('real_06', 'gdgreal06'),
  real('real_07', 'gdgreal07'),
  real('real_08', 'gdgreal08'),
  real('real_09', 'gdgreal09'),
  real('real_10', 'gdgreal10'),
  real('real_11', 'gdgreal11'),
  real('real_12', 'gdgreal12'),
  real('real_13', 'gdgreal13'),
  real('real_14', 'gdgreal14'),
  real('real_15', 'gdgreal15'),
];
