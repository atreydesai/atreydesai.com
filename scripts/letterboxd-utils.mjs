import yaml from "js-yaml";

export function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  return {
    data: yaml.load(match[1]) ?? {},
    lines: match[1].split(/\r?\n/),
    end: match[0].length,
  };
}

export function yamlString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function upsertScalar(text, key, serializedValue, options = {}) {
  const parsed = parseFrontmatter(text);
  if (!parsed) return text;

  const { after = [], overwrite = false } = options;
  const linePattern = new RegExp(`^${escapeRegex(key)}:\\s*`);
  const existingIndex = parsed.lines.findIndex((line) =>
    linePattern.test(line),
  );

  if (existingIndex !== -1) {
    if (!overwrite) return text;
    parsed.lines[existingIndex] = `${key}: ${serializedValue}`;
    return renderFrontmatter(text, parsed);
  }

  let insertAt = null;
  for (const afterKey of after) {
    const afterPattern = new RegExp(`^${escapeRegex(afterKey)}:\\s*`);
    const index = parsed.lines.findLastIndex((line) => afterPattern.test(line));
    if (index === -1) continue;

    // If the anchor is a YAML list/object, insert after its indented block
    // instead of splitting the value from its key.
    let end = index + 1;
    while (end < parsed.lines.length && /^\s+/.test(parsed.lines[end])) end++;
    insertAt = Math.max(insertAt ?? 0, end);
  }

  parsed.lines.splice(
    insertAt ?? parsed.lines.length,
    0,
    `${key}: ${serializedValue}`,
  );
  return renderFrontmatter(text, parsed);
}

export function upsertStringList(text, key, values, options = {}) {
  const parsed = parseFrontmatter(text);
  if (!parsed) return text;

  const { after = [], overwrite = false } = options;
  const linePattern = new RegExp(`^${escapeRegex(key)}:\\s*`);
  const existingIndex = parsed.lines.findIndex((line) =>
    linePattern.test(line),
  );
  const listLines =
    values.length > 0
      ? [`${key}:`, ...values.map((value) => `  - ${yamlString(value)}`)]
      : [`${key}: []`];

  if (existingIndex !== -1) {
    if (!overwrite) return text;
    let end = existingIndex + 1;
    while (end < parsed.lines.length && /^\s+/.test(parsed.lines[end])) end++;
    parsed.lines.splice(existingIndex, end - existingIndex, ...listLines);
    return renderFrontmatter(text, parsed);
  }

  let insertAt = null;
  for (const afterKey of after) {
    const afterPattern = new RegExp(`^${escapeRegex(afterKey)}:\\s*`);
    const index = parsed.lines.findLastIndex((line) => afterPattern.test(line));
    if (index === -1) continue;

    let end = index + 1;
    while (end < parsed.lines.length && /^\s+/.test(parsed.lines[end])) end++;
    insertAt = Math.max(insertAt ?? 0, end);
  }

  parsed.lines.splice(insertAt ?? parsed.lines.length, 0, ...listLines);
  return renderFrontmatter(text, parsed);
}

export function removeScalar(text, key) {
  const parsed = parseFrontmatter(text);
  if (!parsed) return text;

  const linePattern = new RegExp(`^${escapeRegex(key)}:\\s*`);
  const nextLines = parsed.lines.filter((line) => !linePattern.test(line));
  if (nextLines.length === parsed.lines.length) return text;

  parsed.lines = nextLines;
  return renderFrontmatter(text, parsed);
}

export function replaceScalar(text, key, serializedValue) {
  return upsertScalar(text, key, serializedValue, { overwrite: true });
}

export function normalizeTitle(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

export function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, number) =>
      String.fromCodePoint(parseInt(number, 16)),
    )
    .replace(/&apos;|&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function renderFrontmatter(text, parsed) {
  return `---\n${parsed.lines.join("\n")}\n---${text.slice(parsed.end)}`;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
