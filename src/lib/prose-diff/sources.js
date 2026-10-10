// Group dropped or picked files into documents with ordered versions.
//
// Two layouts are recognised, mirroring prose-diff-viewer's sources:
//
// * Revision snapshots: files named `<doc>.<seq>.<UTC stamp>.<label>.md` (the
//   AutoFiction harness convention, usually under `revision_snapshots/<doc>/`).
//   Each document's snapshots are ordered by time, and a working copy named
//   `<doc>.md` outside the snapshots folder is appended as `current`.
// * Loose drafts: any other markdown or text files. Files that share a folder
//   are versions of one document, in natural name order (`draft-2` before
//   `draft-10`).
//
// Everything here works on paths alone, so it never reads a file's contents.

const SNAPSHOT = /^(.+)\.(\d{3,6})\.(\d{8}T\d{6}Z)\.(.+)\.md$/;
const TEXT_FILE = /\.(md|markdown|mdown|txt|text)$/i;
const IGNORED_SEGMENT = /^(\.|node_modules$|__MACOSX$)/;
const SNAPSHOT_DIR = "revision_snapshots";
// Where a document's working copy may live, best match first.
const CURRENT_DIRS = ["chapters", "final", "", "exports"];

/**
 * @typedef {object} Version
 * @property {string} id
 * @property {string} label
 * @property {string} [detail]
 * @property {string} path The file the version reads from.
 */
/**
 * @typedef {object} Document
 * @property {string} id
 * @property {string} title
 * @property {Version[]} versions
 */

/** @param {string} path */
function segments(path) {
    return path.split("/").filter(Boolean);
}

/** @param {string} path */
function basename(path) {
    const parts = segments(path);
    return parts[parts.length - 1] ?? "";
}

/** @param {string} path */
function dirname(path) {
    return segments(path).slice(0, -1).join("/");
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** 20260705T092714Z -> 2026-07-05 09:27 UTC @param {string} stamp */
function formatStamp(stamp) {
    return `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} ${stamp.slice(9, 11)}:${stamp.slice(11, 13)} UTC`;
}

/** @param {string} name */
function titleFrom(name) {
    return name.replace(/\.[^.]+$/, "").replace(/_/g, " ");
}

/**
 * Keep the files the viewer can read, skipping hidden folders and OS debris.
 * @param {string[]} paths
 */
export function usablePaths(paths) {
    return paths.filter((path) => TEXT_FILE.test(path) && !segments(path).some((part) => IGNORED_SEGMENT.test(part)));
}

/**
 * The best `<doc>.md` working copy for a snapshot document, if one exists.
 * @param {string} doc
 * @param {string[]} paths
 */
function findCurrent(doc, paths) {
    const candidates = paths.filter(
        (path) => basename(path) === `${doc}.md` && !segments(path).includes(SNAPSHOT_DIR),
    );
    /** @param {string} path */
    const rank = (path) => {
        const parts = segments(path);
        const parent = parts.length > 1 ? parts[parts.length - 2] : "";
        const index = CURRENT_DIRS.indexOf(parent);
        return index === -1 ? CURRENT_DIRS.length : index;
    };
    return candidates.sort((a, b) => rank(a) - rank(b) || a.length - b.length)[0];
}

/**
 * @param {string[]} paths
 * @returns {Document[]}
 */
function snapshotDocuments(paths) {
    /** @type {Map<string, { version: Version, sort: string }[]>} */
    const byDoc = new Map();
    for (const path of paths) {
        const match = basename(path).match(SNAPSHOT);
        if (!match) continue;
        const [, doc, seq, stamp, label] = match;
        const entry = {
            version: { id: path, label: `#${Number(seq)} ${label}`, detail: formatStamp(stamp), path },
            sort: `${stamp}.${seq}`,
        };
        const list = byDoc.get(doc);
        if (list) list.push(entry);
        else byDoc.set(doc, [entry]);
    }

    return [...byDoc.keys()].sort(collator.compare).map((doc) => {
        const entries = /** @type {{ version: Version, sort: string }[]} */ (byDoc.get(doc));
        const versions = entries.sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0)).map((e) => e.version);
        const current = findCurrent(doc, paths);
        if (current) versions.push({ id: current, label: "current working copy", detail: current, path: current });
        return { id: `snap:${doc}`, title: titleFrom(doc), versions };
    });
}

/**
 * @param {string[]} paths
 * @returns {Document[]}
 */
function looseDocuments(paths) {
    /** @type {Map<string, string[]>} */
    const byDir = new Map();
    for (const path of paths) {
        const dir = dirname(path);
        const list = byDir.get(dir);
        if (list) list.push(path);
        else byDir.set(dir, [path]);
    }

    /**
     * @param {string} id
     * @param {string} title
     * @param {string[]} files
     * @returns {Document}
     */
    const toDocument = (id, title, files) => ({
        id,
        title,
        versions: files
            .slice()
            .sort(collator.compare)
            .map((path) => ({ id: path, label: basename(path), detail: dirname(path) || undefined, path })),
    });

    const groups = [...byDir.entries()].filter(([, files]) => files.length >= 2);
    if (groups.length) {
        return groups
            .sort(([a], [b]) => collator.compare(a, b))
            .map(([dir, files]) => toDocument(`dir:${dir}`, basename(dir) || "files", files));
    }
    // No folder holds two drafts, so every file is a version of one document.
    return paths.length >= 2 ? [toDocument("files", "files", paths)] : [];
}

/**
 * Group file paths into diffable documents. Snapshot documents win when any
 * exist; otherwise loose drafts are grouped by folder.
 * @param {string[]} allPaths
 * @returns {Document[]}
 */
export function groupDocuments(allPaths) {
    const paths = usablePaths(allPaths);
    const snapshots = snapshotDocuments(paths).filter((doc) => doc.versions.length >= 2);
    return snapshots.length ? snapshots : looseDocuments(paths);
}
