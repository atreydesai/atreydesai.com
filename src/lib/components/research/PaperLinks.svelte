<script lang="ts">
    import { Twitter } from "lucide-svelte";
    import { Binary, PenLine, ChevronsUpDown, ChevronsDownUp, CircleArrowOutUpRight } from "@jis3r/icons";
    import FileText from "$lib/components/icons/FileText.svelte";

    export let paper: {
        arxiv: string | null;
        pdf: string | null;
        code: string | null;
        demo: string | null;
        twitter: string | null;
        blog: string | null;
        tldr: string | null;
    };

    export let tldrOpen = false;

    // Per-link hover states for icon animation triggering
    let hoveredLink: string | null = null;

    $: hasLinks = Boolean(
        paper.arxiv ||
            paper.pdf ||
            paper.code ||
            paper.demo ||
            paper.twitter ||
            paper.blog,
    );
</script>

{#if hasLinks || paper.tldr}
    <div
        class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"
    >
        {#if paper.tldr}
            <button
                type="button"
                on:click={() => (tldrOpen = !tldrOpen)}
                on:mouseenter={() => (hoveredLink = 'tldr')}
                on:mouseleave={() => (hoveredLink = null)}
                class="link-subtle inline-flex items-center gap-1.5"
                aria-expanded={tldrOpen}
            >
                {#if tldrOpen}
                    <ChevronsDownUp size={14} animate={hoveredLink === 'tldr'} />
                {:else}
                    <ChevronsUpDown size={14} animate={hoveredLink === 'tldr'} />
                {/if}
                tldr
            </button>
        {/if}
        {#if paper.arxiv}
            <a
                href={paper.arxiv}
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle inline-flex items-center gap-1.5"
                on:mouseenter={() => (hoveredLink = 'arxiv')}
                on:mouseleave={() => (hoveredLink = null)}
            >
                <CircleArrowOutUpRight size={14} animate={hoveredLink === 'arxiv'} />
                arxiv
            </a>
        {/if}

        {#if paper.pdf}
            <a
                href={paper.pdf}
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle inline-flex items-center gap-1.5"
                on:mouseenter={() => (hoveredLink = 'pdf')}
                on:mouseleave={() => (hoveredLink = null)}
            >
                <FileText size={14} animate={hoveredLink === 'pdf'} />
                pdf
            </a>
        {/if}

        {#if paper.code}
            <a
                href={paper.code}
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle inline-flex items-center gap-1.5"
                on:mouseenter={() => (hoveredLink = 'code')}
                on:mouseleave={() => (hoveredLink = null)}
            >
                <Binary size={14} animate={hoveredLink === 'code'} />
                code
            </a>
        {/if}

        {#if paper.demo}
            <a
                href={paper.demo}
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle inline-flex items-center gap-1.5"
                on:mouseenter={() => (hoveredLink = 'demo')}
                on:mouseleave={() => (hoveredLink = null)}
            >
                <CircleArrowOutUpRight size={14} animate={hoveredLink === 'demo'} />
                demo
            </a>
        {/if}

        {#if paper.twitter}
            <a
                href={paper.twitter}
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle inline-flex items-center gap-1.5"
                on:mouseenter={() => (hoveredLink = 'twitter')}
                on:mouseleave={() => (hoveredLink = null)}
            >
                <Twitter size={14} />
                twitter
            </a>
        {/if}

        {#if paper.blog}
            <a
                href={paper.blog}
                target="_blank"
                rel="noopener noreferrer"
                class="link-subtle inline-flex items-center gap-1.5"
                on:mouseenter={() => (hoveredLink = 'blog')}
                on:mouseleave={() => (hoveredLink = null)}
            >
                <PenLine size={14} animate={hoveredLink === 'blog'} />
                blog
            </a>
        {/if}
    </div>
{/if}
