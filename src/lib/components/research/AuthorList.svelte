<script lang="ts">
    import { onMount } from "svelte";

    export let authors: string[];

    let authorsExpanded = false;
    let authorsEl: HTMLElement | null = null;
    let isAuthorsOverflowing = false;
    let visibleCharCount = 0;

    function expandAuthors() {
        if (customCollapse) {
            visibleCharCount =
                authors[0].length + 2 + authors[1].length;
        } else if (authorsEl && authorsEl.scrollWidth > 0) {
            const ratio = authorsEl.clientWidth / authorsEl.scrollWidth;
            visibleCharCount = Math.max(0, Math.floor(totalChars * ratio) - 2);
        } else {
            visibleCharCount = 0;
        }
        authorsExpanded = true;
    }

    $: atreyIdx = authors.findIndex((a) => a.includes("Atrey Desai"));
    $: customCollapse = atreyIdx > 1;
    $: collapsedAuthorList = customCollapse
        ? [
              authors[0],
              authors[1],
              "...",
              authors[atreyIdx],
              ...(atreyIdx < authors.length - 1 ? ["..."] : []),
          ]
        : authors;
    $: hasHiddenAuthors = customCollapse || isAuthorsOverflowing;

    function checkAuthorsOverflow() {
        if (authorsEl) {
            isAuthorsOverflowing = authorsEl.scrollWidth > authorsEl.clientWidth + 1;
        }
    }

    // Characters in the full "A, B, C" list, the unit of the reveal below.
    $: totalChars = [...authors.join(", ")].length;

    $: authorGroups = (() => {
        const groups: { kind: "name" | "sep"; chars: { c: string; bold: boolean; i: number }[] }[] = [];
        let i = 0;
        authors.forEach((author, idx) => {
            const bold = author.includes("Atrey Desai");
            const chars: { c: string; bold: boolean; i: number }[] = [];
            for (const ch of author) chars.push({ c: ch, bold, i: i++ });
            groups.push({ kind: "name", chars });
            if (idx < authors.length - 1) {
                groups.push({
                    kind: "sep",
                    chars: [
                        { c: ",", bold: false, i: i++ },
                        { c: " ", bold: false, i: i++ },
                    ],
                });
            }
        });
        return groups;
    })();

    onMount(() => {
        checkAuthorsOverflow();
        window.addEventListener("resize", checkAuthorsOverflow);
        return () => {
            window.removeEventListener("resize", checkAuthorsOverflow);
        };
    });

    function formatAuthors(authors: string[]): string {
        return authors
            .map((author) => {
                if (author === "...") return "…";
                return author.includes("Atrey Desai")
                    ? `<strong class="text-ink-900 dark:text-cream-100">${author}</strong>`
                    : author;
            })
            .join(", ");
    }
</script>

<div class="mt-2 min-w-0">
    {#if authorsExpanded && hasHiddenAuthors}
        <p
            class="text-sm leading-snug text-ink-600 dark:text-cream-300"
        >
            {#each authorGroups as group}
                {#if group.kind === "name"}
                    <span class="inline-block whitespace-nowrap align-baseline">
                        {#each group.chars as item}
                            <span
                                class="{item.i < visibleCharCount ? '' : 'char-reveal'} {item.bold ? 'font-semibold text-ink-900 dark:text-cream-100' : ''}"
                                style="animation-delay: {(item.i - visibleCharCount) * 8}ms"
                            >{item.c}</span>
                        {/each}
                    </span>
                {:else}
                    {#each group.chars as item}
                        <span
                            class={item.i < visibleCharCount ? '' : 'char-reveal'}
                            style="animation-delay: {(item.i - visibleCharCount) * 8}ms"
                        >{item.c === " " ? " " : item.c}</span>
                    {/each}
                {/if}
            {/each}
        </p>
    {:else if hasHiddenAuthors}
        <button
            type="button"
            on:click={expandAuthors}
            class="block w-full overflow-hidden text-left"
            aria-expanded={authorsExpanded}
        >
            <p
                bind:this={authorsEl}
                class="truncate text-sm leading-snug text-ink-600 dark:text-cream-300"
            >
                {@html formatAuthors(collapsedAuthorList)}
            </p>
        </button>
    {:else}
        <p
            bind:this={authorsEl}
            class="truncate text-sm leading-snug text-ink-600 dark:text-cream-300"
        >
            {@html formatAuthors(authors)}
        </p>
    {/if}
</div>

<style>
    .char-reveal {
        display: inline;
        opacity: 0;
        animation: charReveal var(--motion-instant) ease-out forwards;
    }
    @keyframes charReveal {
        from { opacity: 0; }
        to { opacity: 1; }
    }
</style>
