<script lang="ts">
    // Prose diff viewer: compare two versions of a markdown draft, rendered as
    // prose with additions underlined and deletions struck through. Everything
    // runs in the browser; dropped files are read locally and never uploaded.
    // The sample is this site's about page, one version per commit that changed
    // its prose (generated from the git history of src/content/about.yaml).
    import { onMount, tick } from "svelte";
    import { ArrowDown, ArrowUp } from "@jis3r/icons";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import { diffDocuments, type DiffResult } from "$lib/prose-diff/engine.js";
    import { groupDocuments, usablePaths } from "$lib/prose-diff/sources.js";
    import { drawSquiggle, squiggle } from "$lib/prose-diff/squiggle";

    type Source = "sample" | "paste" | "files";
    type Version = { id: string; label: string };
    type Doc = { id: string; title: string; versions: Version[] };
    type Picked = { path: string; file: File };

    const SOURCES: Source[] = ["sample", "paste", "files"];
    const IGNORED_DIR = /^(\.|node_modules$|__MACOSX$)/;
    const KIND_LABEL = { edited: "edited", added: "added", removed: "removed" };

    let source: Source = "sample";
    let mounted = false;

    let sampleDocs: Doc[] = [];
    let sampleTexts = new Map<string, string>();
    let fileDocs: Doc[] = [];
    let filesByPath = new Map<string, File>();
    let fileTexts = new Map<string, string>();
    let fileCount = 0;
    // Bumped on every drop, so a document id that recurs starts afresh.
    let loadId = 0;
    let fileRoot = "";
    let reading = false;
    let dragging = false;
    let fileInput: HTMLInputElement;
    let folderInput: HTMLInputElement;

    let before = "";
    let after = "";

    let docId = "";
    let baseId = "";
    let compareId = "";
    let cleanRead = false;

    let result: DiffResult | null = null;
    let message = "";
    let failed = false;
    let focusIdx = -1;
    let live = "";
    let docEl: HTMLDivElement;

    $: docs = source === "sample" ? sampleDocs : source === "files" ? fileDocs : [];
    $: doc = docs.find((d) => d.id === docId) ?? docs[0];
    $: docOptions = docs.map((d) => ({ value: d.id, label: d.title }));
    $: versionOptions = (doc?.versions ?? []).map((v) => ({ value: v.id, label: v.label }));
    $: versionIndex = (id: string) => doc?.versions.findIndex((v) => v.id === id) ?? -1;
    $: baseIndex = versionIndex(baseId);
    $: compareIndex = versionIndex(compareId);
    $: versionCount = doc?.versions.length ?? 0;
    $: canStepOlder = baseIndex > 0 && compareIndex > 0;
    $: canStepNewer = baseIndex >= 0 && compareIndex >= 0 && baseIndex < versionCount - 1 && compareIndex < versionCount - 1;
    $: changes = result?.changes ?? [];

    // A new document starts from its first version against its latest.
    let docKey = "";
    $: {
        const key = doc ? `${source}:${loadId}:${doc.id}` : "";
        if (key !== docKey) {
            docKey = key;
            if (doc) {
                baseId = doc.versions[0].id;
                compareId = doc.versions[doc.versions.length - 1].id;
            }
        }
    }

    // Re-diff whenever the pair, the pasted text, or the reading mode changes.
    // Pasted text waits for a pause in typing.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let runToken = 0;
    $: if (mounted) schedule(source, doc, baseId, compareId, before, after, cleanRead);

    // Only typing waits; switching source, versions or mode redraws at once,
    // so the previous diff never lingers under the new controls.
    let lastArgs: Parameters<typeof run> | null = null;

    function schedule(...args: Parameters<typeof run>) {
        clearTimeout(timer);
        const typing =
            args[0] === "paste" &&
            lastArgs?.[0] === "paste" &&
            (args[4] !== lastArgs[4] || args[5] !== lastArgs[5]);
        lastArgs = args;
        if (typing) timer = setTimeout(() => run(...args), 250);
        else run(...args);
    }

    // Steps through the same changes survive a switch into or out of clean
    // read; a different pair starts again from the top.
    let pairKey = "";

    async function run(
        src: Source,
        current: Doc | undefined,
        base: string,
        compare: string,
        oldPaste: string,
        newPaste: string,
        clean: boolean,
    ) {
        const token = ++runToken;
        let oldText: string;
        let newText: string;
        failed = false;
        if (src === "paste") {
            if (!oldPaste.trim() && !newPaste.trim()) {
                result = null;
                message = "";
                return;
            }
            [oldText, newText] = [oldPaste, newPaste];
        } else if (!current) {
            result = null;
            message =
                src === "sample"
                    ? "Loading the sample…"
                    : fileCount
                      ? "Couldn't find two versions of anything here. Try a revision_snapshots folder, or two or more drafts."
                      : "";
            return;
        } else {
            try {
                [oldText, newText] = await Promise.all([textFor(src, base), textFor(src, compare)]);
            } catch {
                if (token !== runToken) return;
                result = null;
                failed = true;
                message = "Couldn't read one of those files. Try choosing it again.";
                return;
            }
        }
        if (token !== runToken) return;

        const key = `${src}\0${current?.id}\0${base}\0${compare}\0${oldPaste}\0${newPaste}`;
        if (key !== pairKey) {
            pairKey = key;
            focusIdx = -1;
        }
        result = diffDocuments(oldText, newText, { showDeletions: !clean, headingShift: 1 });
        message = "";
        await tick();
        drawQuietSquiggles();
        markFocus();
    }

    async function textFor(src: Source, id: string): Promise<string> {
        if (src === "sample") return sampleTexts.get(id) ?? "";
        const cached = fileTexts.get(id);
        if (cached !== undefined) return cached;
        const file = filesByPath.get(id);
        if (!file) throw new Error(`missing file: ${id}`);
        const text = await file.text();
        fileTexts.set(id, text);
        return text;
    }

    function step(delta: number) {
        if (!doc) return;
        const b = baseIndex + delta;
        const c = compareIndex + delta;
        if (b < 0 || c < 0 || b >= versionCount || c >= versionCount) return;
        baseId = doc.versions[b].id;
        compareId = doc.versions[c].id;
    }

    // Every changed passage gets a quiet pencil squiggle in the margin, and
    // the passage being stepped to gets the accent squiggle drawn over it, on
    // the same path.
    let clearQuiet: (() => void)[] = [];
    let clearSquiggle: (() => void) | null = null;

    function addSquiggle(el: Element, seed: string, quiet: boolean) {
        const box = document.createElement("span");
        box.className = "pdv-squiggle";
        el.append(box);
        const stop = drawSquiggle(box, seed, { quiet });
        return () => {
            stop();
            box.remove();
        };
    }

    function drawQuietSquiggles() {
        clearQuiet.forEach((clear) => clear());
        clearQuiet = [];
        if (!docEl) return;
        for (const change of changes) {
            const el = docEl.querySelector(`#${change.id}`);
            if (!el) continue;
            // With deletions hidden, a removed passage leaves only the gap
            // between its neighbours, and its squiggle sits in that gap.
            el.classList.toggle("gap", !el.childNodes.length);
            clearQuiet.push(addSquiggle(el, squiggleSeed(change), true));
        }
    }

    function markFocus() {
        clearSquiggle?.();
        clearSquiggle = null;
        if (!docEl) return;
        docEl.querySelectorAll(".change.focus").forEach((el) => el.classList.remove("focus"));
        const target = focusIdx >= 0 ? changes[focusIdx] : undefined;
        const el = target && docEl.querySelector(`#${target.id}`);
        if (!target || !el) return;
        el.classList.add("focus");
        clearSquiggle = addSquiggle(el, squiggleSeed(target), false);
    }

    const squiggleSeed = (change: { id: string; excerpt: string }) => `${change.id} ${change.excerpt}`;

    function focusChange(index: number) {
        if (!changes.length) return;
        focusIdx = ((index % changes.length) + changes.length) % changes.length;
        markFocus();
        docEl?.querySelector(`#${changes[focusIdx].id}`)?.scrollIntoView({ block: "center" });
        live = `Change ${focusIdx + 1} of ${changes.length}, ${KIND_LABEL[changes[focusIdx].kind]}`;
    }

    function onKeydown(event: KeyboardEvent) {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("input, textarea, select, [contenteditable]")) return;
        if (!changes.length) return;
        if (event.key === "n") focusChange(focusIdx + 1);
        else if (event.key === "p") focusChange(focusIdx - 1);
    }

    // ---- files ----

    function takeFiles(picked: Picked[], root: string) {
        const byPath = new Map<string, File>();
        for (const { path, file } of picked) byPath.set(path, file);
        const paths = usablePaths([...byPath.keys()]);
        filesByPath = byPath;
        fileTexts = new Map();
        fileCount = paths.length;
        fileRoot = root;
        loadId += 1;
        fileDocs = groupDocuments(paths);
        docId = fileDocs[0]?.id ?? "";
    }

    function rootOf(paths: string[]): string {
        const first = paths[0]?.split("/") ?? [];
        return first.length > 1 && paths.every((p) => p.startsWith(`${first[0]}/`)) ? first[0] : "";
    }

    function onPick(event: Event) {
        const input = event.currentTarget as HTMLInputElement;
        const picked = [...(input.files ?? [])].map((file) => ({ path: file.webkitRelativePath || file.name, file }));
        if (picked.length) takeFiles(picked, rootOf(picked.map((p) => p.path)));
        input.value = "";
    }

    function fileFromEntry(entry: FileSystemFileEntry): Promise<File> {
        return new Promise((resolve, reject) => entry.file(resolve, reject));
    }

    function readBatch(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
        return new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    }

    async function walk(entry: FileSystemEntry, out: Picked[]) {
        const path = entry.fullPath.replace(/^\//, "");
        if (entry.isFile) {
            if (usablePaths([path]).length) out.push({ path, file: await fileFromEntry(entry as FileSystemFileEntry) });
            return;
        }
        if (!entry.isDirectory || IGNORED_DIR.test(entry.name)) return;
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        // readEntries hands back a directory in batches, until an empty one.
        for (let batch = await readBatch(reader); batch.length; batch = await readBatch(reader)) {
            for (const child of batch) await walk(child, out);
        }
    }

    async function onDrop(event: DragEvent) {
        event.preventDefault();
        dragging = false;
        const transfer = event.dataTransfer;
        if (!transfer) return;
        // Entries have to be taken before the first await, while the drop's
        // data is still readable.
        const entries = [...transfer.items]
            .map((item) => item.webkitGetAsEntry?.())
            .filter((entry): entry is FileSystemEntry => !!entry);
        const loose = [...transfer.files];
        reading = true;
        try {
            const picked: Picked[] = [];
            if (entries.length) {
                for (const entry of entries) await walk(entry, picked);
            } else {
                for (const file of loose) picked.push({ path: file.name, file });
            }
            const root = entries.length === 1 && entries[0].isDirectory ? entries[0].name : "";
            takeFiles(picked, root);
        } finally {
            reading = false;
        }
    }

    function onDragOver(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
        dragging = true;
    }

    // Excerpts come from the markdown source; drop its emphasis markers.
    function plainExcerpt(excerpt: string) {
        return excerpt.replace(/[*`]+|(?<!\w)_+|_+(?!\w)/g, "");
    }

    function plural(n: number, word: string) {
        return `${n} ${word}${n === 1 ? "" : "s"}`;
    }

    onMount(() => {
        mounted = true;
        import("$lib/prose-diff/sample.json").then(({ default: sample }) => {
            sampleTexts = new Map(sample.versions.map((v) => [v.id, v.text] as [string, string]));
            sampleDocs = [
                { id: "sample", title: sample.title, versions: sample.versions.map(({ id, label }) => ({ id, label })) },
            ];
        });
        return () => {
            clearTimeout(timer);
            clearSquiggle?.();
            clearQuiet.forEach((clear) => clear());
        };
    });
</script>


<svelte:window on:keydown={onKeydown} />

<section class="pdv" aria-label="Prose diff viewer">
    <!-- Roughening for the pen squiggles, as on the homepage's interest loops. -->
    <svg width="0" height="0" class="pdv-defs" aria-hidden="true">
        <filter id="pdv-squiggle-rough" x="-60%" y="-5%" width="220%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="1.8" />
        </filter>
    </svg>
    <!-- Controls, top to bottom in the order they're used: where the text
         comes from, which two versions, what changed, and each change. -->
    <aside class="pdv-side" data-justify="off">
        <div class="pdv-group">
            <span class="meta-label" id="pdv-source-label">source</span>
            <div class="pdv-row" role="group" aria-labelledby="pdv-source-label">
                {#each SOURCES as option}
                    <button
                        type="button"
                        class="control-text"
                        aria-pressed={source === option}
                        on:click={() => (source = option)}>{option}</button
                    >
                {/each}
            </div>
        </div>

        {#if source !== "paste" && doc}
            <div class="pdv-group">
                <span class="meta-label">versions</span>
                <div class="pdv-pickers" class:with-document={docs.length > 1}>
                    {#if docs.length > 1}
                        <CustomSelect
                            options={docOptions}
                            bind:value={docId}
                            resettable={false}
                            searchable={docs.length > 15}
                            searchPlaceholder="find a document"
                            label="document"
                            ariaLabel="Document"
                        />
                    {/if}
                    <CustomSelect
                        options={versionOptions}
                        bind:value={baseId}
                        resettable={false}
                        searchable={versionCount > 15}
                        searchPlaceholder="find a version"
                        label="from"
                        ariaLabel="Earlier version"
                    />
                    <CustomSelect
                        options={versionOptions}
                        bind:value={compareId}
                        resettable={false}
                        searchable={versionCount > 15}
                        searchPlaceholder="find a version"
                        label="to"
                        ariaLabel="Later version"
                    />
                    <div class="pdv-step">
                        <span class="control-label pdv-step-label">step</span>
                        <button
                            type="button"
                            class="control-text"
                            disabled={!canStepOlder}
                            on:click={() => step(-1)}
                            title="Move both versions one older">← older</button
                        >
                        <button
                            type="button"
                            class="control-text"
                            disabled={!canStepNewer}
                            on:click={() => step(1)}
                            title="Move both versions one newer">newer →</button
                        >
                    </div>
                </div>
            </div>
        {/if}

        {#if result}
            <div class="pdv-group">
                <span class="pdv-summary">
                    {#if changes.length}
                        <span class="pdv-fig pdv-fig-add">{result.wordsAdded}</span>
                        {result.wordsAdded === 1 ? "word" : "words"} added and
                        <span class="pdv-fig pdv-fig-del">{result.wordsRemoved}</span> removed, in
                        <span class="pdv-fig">{changes.length}</span>
                        {changes.length === 1 ? "place" : "places"}.
                    {:else}
                        No changes between these versions.
                    {/if}
                </span>
                {#if changes.length}
                    <div class="pdv-row">
                        <button
                            type="button"
                            class="control-text"
                            aria-pressed={cleanRead}
                            on:click={() => (cleanRead = !cleanRead)}>hide deletions</button
                        >
                    </div>
                {/if}
            </div>

            {#if changes.length}
                <div class="pdv-group pdv-changes">
                    <div class="pdv-changes-head">
                        <span class="meta-label">changes</span>
                        <span class="pdv-stepper">
                            <button
                                type="button"
                                class="control-text"
                                on:click={() => focusChange(focusIdx - 1)}
                                aria-label="Previous change"
                                title="Previous change (p)"
                            >
                                <ArrowUp size={14} />
                            </button>
                            <span class="pdv-pos" aria-hidden="true">
                                {focusIdx >= 0 ? focusIdx + 1 : "–"} / {changes.length}
                            </span>
                            <button
                                type="button"
                                class="control-text"
                                on:click={() => focusChange(focusIdx + 1)}
                                aria-label="Next change"
                                title="Next change (n)"
                            >
                                <ArrowDown size={14} />
                            </button>
                        </span>
                    </div>
                    <ol class="pdv-change-list">
                        {#each changes as change, i (change.id)}
                            <li>
                                <button
                                    type="button"
                                    class="pdv-change-row"
                                    aria-current={i === focusIdx ? "true" : undefined}
                                    on:click={() => focusChange(i)}
                                >
                                    {#if i === focusIdx}
                                        <span class="pdv-squiggle pdv-squiggle-row" use:squiggle={squiggleSeed(change)}
                                        ></span>
                                    {/if}
                                    <span class="pdv-kind pdv-kind-{change.kind}">{KIND_LABEL[change.kind]}</span>
                                    <span class="pdv-excerpt">{plainExcerpt(change.excerpt)}</span>
                                </button>
                            </li>
                        {/each}
                    </ol>
                </div>
            {/if}
        {/if}
    </aside>

    <div class="pdv-main">
        {#if source === "paste"}
            <div class="pdv-paste" data-justify="off">
                <label class="pdv-field">
                    <span class="control-label">from</span>
                    <textarea bind:value={before} rows="9" placeholder="The earlier draft…" spellcheck="false"></textarea>
                </label>
                <label class="pdv-field">
                    <span class="control-label">to</span>
                    <textarea bind:value={after} rows="9" placeholder="…and the later one." spellcheck="false"></textarea>
                </label>
            </div>
        {:else if source === "files"}
            <div
                class="pdv-drop"
                class:dragging
                role="region"
                aria-label="Drop files"
                data-justify="off"
                on:dragenter={onDragOver}
                on:dragover={onDragOver}
                on:dragleave={() => (dragging = false)}
                on:drop={onDrop}
            >
                <span class="pdv-drop-lead">
                    {#if reading}
                        Reading…
                    {:else if fileCount}
                        {plural(fileCount, "file")}{fileRoot ? ` from ${fileRoot}` : ""}. Drop more to replace them.
                    {:else}
                        Drop a folder of drafts here, or a few markdown files.
                    {/if}
                </span>
                <span class="pdv-drop-actions">
                    <button type="button" class="control-text control-accent" on:click={() => fileInput.click()}>
                        choose files
                    </button>
                    <button type="button" class="control-text control-accent" on:click={() => folderInput.click()}>
                        choose folder
                    </button>
                </span>
                <span class="pdv-note">Files are read here in your browser and never uploaded.</span>
                <input
                    bind:this={fileInput}
                    type="file"
                    multiple
                    accept=".md,.markdown,.mdown,.txt,.text,text/markdown,text/plain"
                    hidden
                    on:change={onPick}
                />
                <input bind:this={folderInput} type="file" webkitdirectory multiple hidden on:change={onPick} />
            </div>
        {/if}

        <div class="pdv-reading" class:below-inputs={source !== "sample" && (result || message)}>
            {#if result}
                <div class="pdv-doc measure-reading" bind:this={docEl}>
                    {@html result.html}
                </div>
                {#if changes.length}
                    <!-- On narrow screens the controls scroll away above the text,
                         so the stepper rides along the bottom of the screen. -->
                    <div class="pdv-nav-wrap" data-justify="off">
                        <div class="pdv-nav">
                            <button
                                type="button"
                                class="control-text"
                                on:click={() => focusChange(focusIdx - 1)}
                                aria-label="Previous change"
                            >
                                <ArrowUp size={14} />
                            </button>
                            <span class="pdv-pos" aria-hidden="true">
                                {focusIdx >= 0 ? focusIdx + 1 : "–"} / {changes.length}
                            </span>
                            <button
                                type="button"
                                class="control-text"
                                on:click={() => focusChange(focusIdx + 1)}
                                aria-label="Next change"
                            >
                                <ArrowDown size={14} />
                            </button>
                        </div>
                    </div>
                {/if}
            {:else if message}
                <div class="pdv-empty measure-reading" class:failed data-justify="off">
                    {message}
                </div>
            {/if}
        </div>
    </div>

    <div class="sr-only" aria-live="polite">{live}</div>
</section>

<style>
    /* One column on narrow screens, controls first. From lg the controls
       become a sticky sidebar beside the text, as in the bookshelf's
       companion panel, and the tool spans the bookshelf's wide measure. */
    .pdv {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-8);
        margin: var(--space-10) 0;
    }

    .pdv-defs {
        position: absolute;
    }

    .pdv-side {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    .pdv-main {
        min-width: 0;
    }

    @media (min-width: 1024px) {
        .pdv {
            grid-template-columns: 16rem minmax(0, 1fr);
            gap: var(--space-12);
            align-items: start;
        }

        .pdv-side {
            position: sticky;
            top: var(--space-6);
            max-height: calc(100vh - 2 * var(--space-6));
        }
    }

    .pdv-group {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
    }

    /* Text controls are pulled out by their inline padding so their text
       lines up with the column edge, as in the page header aside. */
    .pdv-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1);
        margin-inline: calc(-1 * var(--space-1-5));
    }

    /* The pickers read as a small form: each dimension in a fixed-width
       label column, values aligned beside it. */
    .pdv-pickers {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-0-5);
        margin-inline: calc(-1 * var(--space-1-5));
    }

    .pdv-pickers :global(.select-trigger .control-label) {
        min-width: 4ch;
        text-align: left;
    }

    .pdv-pickers.with-document :global(.select-trigger .control-label) {
        min-width: 8ch;
    }

    /* The step label has no control padding of its own, so it carries the
       trigger's inline padding to keep the buttons under the values. */
    .pdv-step-label {
        min-width: calc(4ch + var(--space-1-5));
    }

    .with-document .pdv-step-label {
        min-width: calc(8ch + var(--space-1-5));
    }

    .pdv-step {
        display: flex;
        align-items: center;
    }

    .pdv-step-label {
        padding-inline-start: var(--space-1-5);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
    }

    .pdv-note {
        color: theme("colors.ink.500");
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
    }

    :global(.dark) .pdv-note {
        color: theme("colors.cream.400");
    }

    /* ---- summary ---- */
    .pdv-summary {
        font-family: var(--font-prose);
        font-size: 0.95rem;
        line-height: 1.47;
    }

    .pdv-fig {
        font-family: var(--font-mono);
        font-size: 0.85em;
        font-variant-numeric: lining-nums tabular-nums;
    }

    .pdv-fig-add {
        color: theme("colors.steel.DEFAULT");
    }

    .pdv-fig-del {
        color: theme("colors.wine.DEFAULT");
    }

    :global(.dark) .pdv-fig-add {
        color: theme("colors.steel.light");
    }

    :global(.dark) .pdv-fig-del {
        color: theme("colors.wine.light");
    }

    /* ---- changes ---- */
    .pdv-changes {
        min-height: 0;
    }

    @media (min-width: 1024px) {
        /* The list takes whatever height the sidebar has left. */
        .pdv-changes {
            flex: 1 1 auto;
        }
    }

    .pdv-changes-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
    }

    .pdv-stepper {
        display: inline-flex;
        align-items: center;
        margin-inline-end: calc(-1 * var(--space-1-5));
    }

    .pdv .pdv-change-list {
        flex: 1 1 auto;
        min-height: 0;
        max-height: 12rem;
        overflow-y: auto;
        /* A gutter inside the scroll box for the current row's squiggle,
           which would otherwise be clipped; the margin takes it back out so
           the rows stay where they were. */
        margin: 0 calc(-1 * var(--space-1-5)) 0 calc(-1 * var(--space-1-5) - 10px);
        padding: 0 0 0 10px;
        list-style: none;
        scrollbar-width: thin;
    }

    @media (min-width: 1024px) {
        .pdv .pdv-change-list {
            max-height: none;
        }
    }

    .pdv .pdv-change-list li {
        margin: 0;
    }

    .pdv-change-row {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: var(--space-0-5);
        width: 100%;
        padding: var(--space-1-5);
        text-align: left;
        color: theme("colors.ink.700");
        background: transparent;
        border: 0;
        border-radius: var(--radius-control);
        cursor: pointer;
        transition: background-color var(--motion-base) var(--ease-standard);
    }

    .pdv-change-row:hover,
    .pdv-change-row:focus-visible {
        background: rgb(232 93 76 / 0.06);
    }

    /* The change being stepped to carries the same squiggle as its passage
       in the text. */
    .pdv-change-row[aria-current="true"] {
        background: rgb(232 93 76 / 0.08);
    }

    /* Hangs just outside the row's wash, in the gutter, as the passage's
       squiggle hangs in the text's margin. */
    .pdv-squiggle-row {
        top: var(--space-1-5);
        bottom: var(--space-1-5);
        left: -9px;
    }

    :global(.dark) .pdv-change-row {
        color: theme("colors.cream.200");
    }

    :global(.dark) .pdv-change-row:hover,
    :global(.dark) .pdv-change-row:focus-visible {
        background: rgb(245 230 211 / 0.05);
    }

    :global(.dark) .pdv-change-row[aria-current="true"] {
        background: rgb(232 93 76 / 0.08);
    }

    .pdv-kind {
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
        color: theme("colors.ink.500");
    }

    .pdv-kind-added {
        color: theme("colors.steel.DEFAULT");
    }

    .pdv-kind-removed {
        color: theme("colors.wine.DEFAULT");
    }

    :global(.dark) .pdv-kind {
        color: theme("colors.cream.400");
    }

    :global(.dark) .pdv-kind-added {
        color: theme("colors.steel.light");
    }

    :global(.dark) .pdv-kind-removed {
        color: theme("colors.wine.light");
    }

    .pdv-excerpt {
        display: -webkit-box;
        overflow: hidden;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        font-family: var(--font-prose);
        font-size: 0.95rem;
        line-height: 1.47;
    }

    .pdv-pos {
        min-width: 7ch;
        text-align: center;
        color: theme("colors.ink.500");
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
        font-variant-numeric: lining-nums tabular-nums;
    }

    :global(.dark) .pdv-pos {
        color: theme("colors.cream.400");
    }

    /* ---- paste ---- */
    .pdv-paste {
        display: grid;
        grid-template-columns: 1fr;
        gap: var(--space-3);
    }

    @media (min-width: 480px) {
        .pdv-paste {
            grid-template-columns: 1fr 1fr;
        }
    }

    .pdv-field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1-5);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
    }

    .pdv-field textarea {
        width: 100%;
        min-height: 12rem;
        resize: vertical;
        padding: var(--space-2-5) var(--space-3);
        color: theme("colors.ink.700");
        background: theme("colors.cream.50");
        border: 1px solid theme("colors.ink.200");
        border-radius: var(--radius-control);
        font-family: var(--font-prose);
        font-size: 0.95rem;
        line-height: 1.47;
        transition: border-color var(--motion-fast) var(--ease-standard);
    }

    .pdv-field textarea:hover,
    .pdv-field textarea:focus-visible {
        border-color: theme("colors.ink.500");
    }

    .pdv-field textarea::placeholder {
        color: theme("colors.ink.500");
    }

    :global(.dark) .pdv-field textarea {
        color: theme("colors.cream.200");
        background: theme("colors.ink.800");
        border-color: theme("colors.ink.700");
    }

    :global(.dark) .pdv-field textarea:hover,
    :global(.dark) .pdv-field textarea:focus-visible {
        border-color: theme("colors.cream.400");
    }

    :global(.dark) .pdv-field textarea::placeholder {
        color: theme("colors.cream.400");
    }

    /* ---- files ---- */
    .pdv-drop {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-2);
        padding: var(--space-4) var(--space-5);
        border: 1px dashed theme("colors.ink.300");
        border-radius: var(--radius-control);
        transition:
            border-color var(--motion-fast) var(--ease-standard),
            background-color var(--motion-fast) var(--ease-standard);
    }

    .pdv-drop.dragging {
        border-color: theme("colors.accent.dark");
        background: rgb(232 93 76 / 0.06);
    }

    :global(.dark) .pdv-drop {
        border-color: theme("colors.ink.600");
    }

    :global(.dark) .pdv-drop.dragging {
        border-color: theme("colors.accent.light");
        background: rgb(245 230 211 / 0.05);
    }

    .pdv-drop-lead {
        font-family: var(--font-prose);
        font-size: 0.95rem;
        line-height: 1.47;
    }

    .pdv-drop-actions {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        margin-inline: calc(-1 * var(--space-1-5));
    }

    /* ---- reading pane ---- */
    .below-inputs {
        margin-top: var(--space-6);
        padding-top: var(--space-6);
        border-top: 1px solid theme("colors.ink.200");
    }

    :global(.dark) .below-inputs {
        border-color: theme("colors.ink.700");
    }

    .pdv-empty {
        color: theme("colors.ink.500");
        font-style: italic;
    }

    .pdv-empty.failed {
        color: theme("colors.wine.DEFAULT");
    }

    :global(.dark) .pdv-empty {
        color: theme("colors.cream.400");
    }

    :global(.dark) .pdv-empty.failed {
        color: theme("colors.wine.light");
    }

    .pdv-doc > :global(:first-child),
    .pdv-doc > :global(.change:first-child > :first-child) {
        margin-top: 0;
    }

    .pdv-doc :global(h4),
    .pdv-doc :global(h5),
    .pdv-doc :global(h6) {
        margin-top: var(--space-6);
        margin-bottom: var(--space-2);
        font-size: 1.1rem;
        font-style: italic;
    }

    /* Scene breaks, set as the asterism a manuscript would use. */
    .pdv-doc :global(hr) {
        height: auto;
        margin: var(--space-8) 0;
        overflow: visible;
        border: 0;
        text-align: center;
    }

    .pdv-doc :global(hr)::before {
        content: "* * *";
        color: theme("colors.ink.400");
        letter-spacing: 0.4em;
    }

    :global(.dark) .pdv-doc :global(hr)::before {
        color: theme("colors.cream.500");
    }

    /* latexdiff conventions in the support palette: additions in steel and
       underlined, deletions in wine and struck through, each on a faint wash
       of its own hue. The marks carry the meaning; the hue only helps. The
       default shades clear 4.5:1 on their washes (4.9 and 6.6). */
    .pdv-doc :global(ins) {
        color: theme("colors.steel.DEFAULT");
        background: rgb(58 106 145 / 0.08);
        text-decoration: underline;
        text-decoration-thickness: 1px;
        text-underline-offset: 3px;
        border-radius: var(--radius-control);
    }

    .pdv-doc :global(del) {
        color: theme("colors.wine.DEFAULT");
        background: rgb(138 50 81 / 0.08);
        text-decoration: line-through;
        text-decoration-thickness: 1px;
        border-radius: var(--radius-control);
    }

    :global(.dark) .pdv-doc :global(ins) {
        color: theme("colors.steel.light");
        background: rgb(31 69 103 / 0.45);
    }

    :global(.dark) .pdv-doc :global(del) {
        color: theme("colors.wine.light");
        background: rgb(94 31 55 / 0.45);
    }

    .pdv-doc :global(ins.block),
    .pdv-doc :global(del.block) {
        display: block;
        padding: var(--space-0-5) var(--space-2);
    }

    /* Change bars in the margin, as the changebar package draws them, but
       drawn by hand: a pencil squiggle beside every changed passage, and the
       riso accent squiggle over it beside the one being stepped to. Both come
       from $lib/prose-diff/squiggle, roughened like the homepage's interest
       loops. The accent one prints a second pass off register and inks in
       from the top when it appears; the list's current row repeats it. */
    .pdv-doc :global(.change) {
        position: relative;
        scroll-margin-block: 30vh;
    }
    :global(.pdv-squiggle) {
        position: absolute;
        width: 10px;
        pointer-events: none;
    }

    .pdv-doc :global(.pdv-squiggle) {
        top: 0.15em;
        bottom: 0.15em;
        left: calc(-1 * var(--space-3) - 4px);
    }

    /* With deletions hidden, a removed passage has no text left to stand
       beside, so its squiggle is a short one in the gap where it was. */
    .pdv-doc :global(.change.gap > .pdv-squiggle) {
        top: calc(-1 * var(--space-4) - 2px);
        bottom: auto;
        height: 12px;
    }

    :global(.squiggle-svg) {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
        filter: url(#pdv-squiggle-rough);
    }

    :global(.squiggle-line),
    :global(.squiggle-ghost) {
        fill: none;
        stroke: var(--mark-plate);
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 1;
        stroke-dashoffset: 1;
        animation: pdv-squiggle-ink var(--motion-reveal) var(--ease-emphasized) forwards;
    }

    :global(.squiggle-line) {
        stroke-width: 1.7;
    }

    :global(.squiggle-quiet .squiggle-line) {
        stroke: theme("colors.ink.300");
        stroke-width: 1.2;
        stroke-dashoffset: 0;
        animation: none;
    }

    /* A shade lighter than the old 2px bar's ink-600: the pen line is
       thinner, so it needs the extra value to read on ink-900. */
    :global(.dark .squiggle-quiet .squiggle-line) {
        stroke: theme("colors.ink.500");
    }

    .pdv-doc :global(.change.gap .squiggle-quiet .squiggle-line) {
        stroke: theme("colors.wine.DEFAULT");
    }

    :global(.dark) .pdv-doc :global(.change.gap .squiggle-quiet .squiggle-line) {
        stroke: theme("colors.wine.light");
    }

    :global(.squiggle-ghost) {
        stroke-width: 1.2;
        opacity: 0.4;
        transform: translate(1.4px, 1.6px);
        animation-delay: 60ms;
    }

    @keyframes -global-pdv-squiggle-ink {
        to {
            stroke-dashoffset: 0;
        }
    }

    .pdv-nav-wrap {
        position: sticky;
        bottom: var(--space-4);
        z-index: var(--layer-sticky);
        display: flex;
        justify-content: flex-end;
        margin-top: var(--space-4);
        pointer-events: none;
    }

    @media (min-width: 1024px) {
        .pdv-nav-wrap {
            display: none;
        }
    }

    .pdv-nav {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-1);
        background: theme("colors.cream.50");
        border-radius: var(--radius-control);
        box-shadow: var(--shadow-popover);
        pointer-events: auto;
    }

    :global(.dark) .pdv-nav {
        background: theme("colors.ink.800");
        box-shadow:
            0 0 0 1px theme("colors.ink.700"),
            var(--shadow-popover-dark);
    }
</style>
