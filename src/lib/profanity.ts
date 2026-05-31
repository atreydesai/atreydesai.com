// Leaderboard name moderation. Used on the client for instant feedback and on
// the server (/api/scores) as the authority. We normalize common leetspeak and
// strip non-letters, then reject names whose normalized form contains a blocked
// term — profanity, slurs, hate/violence, and crypto-scam bait. For 10-char
// game tags we intentionally err toward blocking; the UI just asks for another.

export const MAX_NAME = 20;

const LEET: Record<string, string> = {
	"0": "o", "1": "i", "2": "z", "3": "e", "4": "a", "5": "s",
	"6": "g", "7": "t", "8": "b", "9": "g", "@": "a", "$": "s", "!": "i",
};

function normalize(s: string): string {
	return [...s.toLowerCase()]
		.map((c) => LEET[c] ?? c)
		.join("")
		.replace(/[^a-z]/g, "");
}

// Matched as substrings against the normalized (letters-only) form.
const BLOCKED: string[] = [
	// profanity
	"fuck", "shit", "bitch", "cunt", "asshole", "dick", "pussy", "bastard",
	"slut", "whore", "wank", "bollock", "prick", "douche", "dumbass", "twat",
	"cock", "boner", "jizz", "cum",
	// slurs (zero tolerance)
	"nigger", "nigga", "faggot", "fag", "retard", "spic", "chink", "kike",
	"tranny", "dyke", "coon", "wetback", "gook", "beaner", "paki", "raghead",
	"towelhead", "negro", "redskin",
	// hate / violence
	"nazi", "hitler", "kkk", "rape", "rapist", "kys", "killyourself", "incel",
	"slavery",
	// crypto / scam bait
	"bitcoin", "ethereum", "crypto", "airdrop", "freemoney", "claimnow",
	"giveaway", "presale", "memecoin", "dogecoin", "elonmusk", "metamask",
	"seedphrase", "nftdrop", "forex", "onlyfans", "dotcom", "telegram",
	"discordgg", "visitmy",
];

export interface NameCheck {
	ok: boolean;
	value?: string;
	reason?: string;
}

export function cleanName(raw: string): NameCheck {
	const name = raw.trim();
	if (!name) return { ok: false, reason: "enter a name" };
	if (name.length > MAX_NAME) return { ok: false, reason: `too long — ${MAX_NAME} max` };
	if (!/^[A-Za-z0-9 ]+$/.test(name)) {
		return { ok: false, reason: "letters & numbers only" };
	}
	const norm = normalize(name);
	if (norm && BLOCKED.some((w) => norm.includes(w))) {
		return { ok: false, reason: "pick a different name" };
	}
	return { ok: true, value: name };
}
