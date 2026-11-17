import { defineEnvVars } from '@sveltejs/kit/env';

// Read at request time. Without a token the boba leaderboard reports itself
// offline (api/scores treats '' as missing), so '' is the right fallback.
export const variables = defineEnvVars({ BLOB_READ_WRITE_TOKEN: { schema: (input) => input ?? '' } });
