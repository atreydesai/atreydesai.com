export const GARDEN_FEATURE = {
  shop: "garden",
  tea: "oolong",
  pairing: ["oolong", "peach"],
  recipe: "signature-fruit-tea-2-0",
  kit: "brew-precision",
  sampleDays: 4,
  // Base prices in cents, before the Workshop purchase multiplier.
  calibrationCost: 2_800,
  trainingCost: 3_200,
  trainingEnergy: 20,
  minimumGrade: 90,
  premium: 1.18,
} as const;

export const GARDEN_OFFER_WINDOW_SECONDS = 6;

export const WAIT_ESTIMATE = { delay: 14, minimumWait: 8, missedTip: 0.75 } as const;

export const PREMIUM_MENU = {
  minimumGrade: 90,
  earnedPrice: 1.22,
  earnedTip: 1.12,
  precisionBrewPrice: 1.15,
  refundPrice: 0.92,
  disappointedTip: 0.72,
} as const;
