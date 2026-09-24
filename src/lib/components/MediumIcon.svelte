<script lang="ts">
    import {
        BookOpenText,
        BookText,
        Clapperboard,
        FileChartLine,
        FilePenLine,
        FileQuestionMark,
        FileText,
        GalleryHorizontal,
        MessageSquareMore,
        NotebookPen,
        Play,
    } from "@jis3r/icons";

    export let medium: string | null | undefined = null;
    export let animate = false;
    export let size = 15;
    export let strokeWidth = 2;
    export let className = "";

    $: normalized = (medium || "").toLowerCase();
    $: iconClass = className || "text-ink-400 dark:text-ink-400";
</script>

{#if normalized === "book"}
    <BookOpenText {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "short story" || normalized === "chapter"}
    <BookText {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "blog post"}
    <NotebookPen {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "article"}
    <FilePenLine {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "research paper" || normalized === "paper"}
    <FileChartLine {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "thread"}
    <MessageSquareMore {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "video"}
    <Play {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "movie"}
    <Clapperboard {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "show" || normalized === "drama"}
    <GalleryHorizontal {size} {strokeWidth} {animate} class={iconClass} />
{:else if normalized === "essay" || normalized === "report"}
    <FileText {size} {strokeWidth} {animate} class={iconClass} />
{:else}
    <FileQuestionMark {size} {strokeWidth} {animate} class={iconClass} />
{/if}
