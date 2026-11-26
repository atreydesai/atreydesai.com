import { REGULARS } from "./orders-service.ts";

export const GUESTBOOK_STAMP_GOAL = 3;

const NOTES: Readonly<Record<string, string>> = {
  mochi: "I finished the chapter by the window. Same seat tomorrow?",
  biscuit: "I saved the last pearl for the walk home.",
  juniper: "No ice, just right. You remembered.",
  bean: "The extra coin under the saucer was on purpose.",
  tofu: "Thanks for keeping the kettle on for me.",
  pip: "I could hear the ice all the way down the block.",
  nori: "Your strawberry tea smells like the first day of summer.",
  clementine: "I’m bringing my sister for a jasmine next time.",
  bao: "I passed! The next bun is a celebration bun.",
  oats: "That last sip tasted exactly like banana bread.",
  peaches: "I ran a personal best with one of your cups on the bench.",
  dumpling: "I still think the bun goes best with the very first sip.",
  pudding: "You can put an extra scoop on my birthday.",
  sprout: "Thanks for setting my cup where I could reach it.",
  figgy: "My friend keeps asking where I got their tea.",
  miso: "Still cold when I got home. Excellent work.",
  basil: "I could taste the jasmine this time. Keep it just like that.",
  maple: "You made my usual before I could say it. Nice one, chef.",
  kiwi: "I took the long way home to finish the pudding.",
  honey: "Whoever put side B on today has excellent taste.",
  rye: "I look for your lit window on the way home.",
  sesame: "I left a good book on the sill. Pass it around.",
  yuzu: "I let the second call go to voicemail. Worth it.",
  lychee: "I counted ten crisp corners. I might need another.",
  pepper: "Thanks for putting on my song again.",
  cocoa: "This is the nicest part of getting off the night shift.",
  chai: "Three down, seven letters. You can brew it.",
  noodle: "Your cup sleeve made a fine bookmark.",
  pickles: "The wide straw got every last pearl. I checked.",
  olive: "I caught the bus. The waffle was gone by my stop.",
  tahini: "The afternoon light fell right across my teacup today.",
  sloe: "I saved the last frame for the light in your window.",
  clove: "You heard me warming up by the market? I was playing for the tea.",
  clover: "The greenhouse smells like wet soil. My sleeves smell like jasmine.",
  mallow: "For once, the only bell I had to listen for was yours.",
};

export const SHOP_KEEPSAKES = [
  { id: "postcard", name: "Window postcard", threshold: 2, icon: "ticket" },
  { id: "plant", name: "Counter plant", threshold: 5, icon: "street-sign" },
  { id: "charm", name: "Pearl charm", threshold: 9, icon: "special" },
  { id: "cup-trophy", name: "Good Cup trophy", threshold: 14, icon: "cup" },
] as const;

export type ShopKeepsake = typeof SHOP_KEEPSAKES[number];

export function guestbookNote(id: string): string {
  return Object.hasOwn(NOTES, id) ? NOTES[id] : "I’ll be back for another cup.";
}

export function guestbookStamps(visits: number | undefined): number {
  return typeof visits === "number" && Number.isSafeInteger(visits)
    ? Math.max(0, Math.min(GUESTBOOK_STAMP_GOAL, visits))
    : 0;
}

export function completedGuestCards(visits: Readonly<Record<string, number>>): number {
  return REGULARS.filter(({ id }) => Object.hasOwn(visits, id) && guestbookStamps(visits[id]) === GUESTBOOK_STAMP_GOAL).length;
}

export function shopKeepsakes(visits: Readonly<Record<string, number>>): ShopKeepsake[] {
  const completed = completedGuestCards(visits);
  return SHOP_KEEPSAKES.filter(({ threshold }) => completed >= threshold);
}
