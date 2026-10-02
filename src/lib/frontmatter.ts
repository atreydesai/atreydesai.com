// Frontmatter validation: malformed content files should fail the build
// instead of rendering broken. Every caller runs at module scope in a module
// the build evaluates (prerendered endpoints import $lib/content; SvelteKit's
// post-build analysis imports each route's server load, which pulls in
// $lib/server/books), so a throw here aborts `vite build` with the offending
// file named.
type FieldType = 'string' | 'number' | 'array' | 'string|null';

export function validateFrontmatter(path: string, mod: unknown, required: Record<string, FieldType>): void {
    const data = mod as Record<string, unknown>;
    for (const [field, type] of Object.entries(required)) {
        const value = data[field];
        const ok =
            type === 'array' ? Array.isArray(value)
            : type === 'string|null' ? value === null || typeof value === 'string'
            : typeof value === type;
        if (!ok) {
            throw new Error(`Invalid frontmatter in ${path}: "${field}" missing or not a ${type}`);
        }
    }
}
