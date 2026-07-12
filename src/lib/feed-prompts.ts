/** Rotating conversation starters — one per day, so the box never feels stale. */
const PROMPTS = [
  "Ի՞նչ սովորեցիր այս շաբաթ, որով հպարտ ես։",
  "Ցույց տուր նախագծիդ ընթացքը՝ մեկ նկարով։",
  "Ի՞նչ գաղափար ունես, որին թիմակիցներ են պետք։",
  "Խորհուրդ տուր նոր միացած ուսանողին։",
  "Ո՞ր հմտությունն ես հիմա սովորում և ինչու։",
  "Կիսվիր այս շաբաթվա փոքր հաղթանակով։",
  "Ի՞նչ միջոցառման ես պատրաստվում մասնակցել։",
];

export function dailyPrompt(offset = 0) {
  const day = Math.floor(Date.now() / 86_400_000);
  return PROMPTS[(day + offset) % PROMPTS.length];
}
