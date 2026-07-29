<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import { Download } from "@jis3r/icons";

    let hoveredDownload = false;
</script>

<PageShell
    title="Resume | Atrey Desai"
    description="Resume of Atrey Desai - CS & Linguistics student at University of Maryland, researching NLP and AI safety."
    url="https://atreydesai.com/resume/"
>
    <header slot="header" class="page-header page-header-action">
        <h1 class="type-page-title text-ink-900 dark:text-cream-100">
            resume
        </h1>

        <a
            href="/resume.pdf"
            download="Atrey_Desai_Resume.pdf"
            class="btn-primary inline-flex items-center gap-2 hover:-translate-y-0.5"
            on:mouseenter={() => (hoveredDownload = true)}
            on:mouseleave={() => (hoveredDownload = false)}
        >
            <Download size={16} animate={hoveredDownload} />
            Download PDF
        </a>
    </header>

    <p class="deck text-ink-600 dark:text-cream-400 mb-8">
        A one-page summary of my experience, skills, and education. For a more
        comprehensive overview, see my <a href="/cv/" class="link">CV</a>.
    </p>

    <!-- PDF Embed -->
    <div
        class="surface-document w-full border border-cream-200 dark:border-ink-700"
    >
        <iframe
            src="/resume.pdf"
            class="w-full h-[80vh] min-h-[600px]"
            title="Atrey Desai Resume"
        ></iframe>
    </div>
</PageShell>
