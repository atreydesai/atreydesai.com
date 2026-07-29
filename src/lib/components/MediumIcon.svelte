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
    export let className = "";

    $: normalized = (medium || "").toLowerCase();
    $: iconClass = className || "text-ink-400 dark:text-ink-500";
</script>

{#if normalized === "book"}
    <BookOpenText {size} {animate} class={iconClass} />
{:else if normalized === "short story"}
    <BookText {size} {animate} class={iconClass} />
{:else if normalized === "blog post"}
    <NotebookPen {size} {animate} class={iconClass} />
{:else if normalized === "article"}
    <FilePenLine {size} {animate} class={iconClass} />
{:else if normalized === "research paper" || normalized === "paper"}
    <FileChartLine {size} {animate} class={iconClass} />
{:else if normalized === "thread"}
    <MessageSquareMore {size} {animate} class={iconClass} />
{:else if normalized === "video"}
    <Play {size} {animate} class={iconClass} />
{:else if normalized === "movie"}
    <Clapperboard {size} {animate} class={iconClass} />
{:else if normalized === "show" || normalized === "drama"}
    <GalleryHorizontal {size} {animate} class={iconClass} />
{:else if normalized === "essay"}
    <FileText {size} {animate} class={iconClass} />
{:else}
    <FileQuestionMark {size} {animate} class={iconClass} />
{/if}
