// One-off: wipe the boba leaderboard blob (clears test entries).
// Run: node --env-file=.env.development.local scripts/reset-leaderboard.mjs
import { del, list } from "@vercel/blob";

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
	console.error("no BLOB_READ_WRITE_TOKEN in env");
	process.exit(1);
}

try {
	await del("boba/v2-leaderboard.json", { token });
	console.log("deleted boba/v2-leaderboard.json");
} catch (e) {
	console.log("del:", e?.message ?? e);
}

const { blobs } = await list({ prefix: "boba/v2-leaderboard.json", token });
console.log("remaining leaderboard blobs:", blobs.length);
