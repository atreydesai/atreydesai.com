<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import { Download } from "@jis3r/icons";

    let hoveredDownload = false;
</script>

<PageShell
    title="Resume | Atrey Desai"
    description="Resume of Atrey Desai - CS & Linguistics student at University of Maryland, researching NLP and AI safety."
    url="https://atreydesai.com/resume/"
    heading="resume"
>
    <a
        slot="aside"
        href="/resume.pdf"
        download="Atrey_Desai_Resume.pdf"
        class="control-text control-accent"
        on:mouseenter={() => (hoveredDownload = true)}
        on:mouseleave={() => (hoveredDownload = false)}
    >
        <Download size={13} animate={hoveredDownload} />
        Download PDF
    </a>

    <svelte:fragment slot="deck">
        A one-page summary of my experience, skills, and education. For a more
        comprehensive overview, see my <a href="/cv/" class="link">CV</a>.
    </svelte:fragment>

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
