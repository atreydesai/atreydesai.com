<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import Download from "lucide-svelte/icons/download";
    import FileText from "lucide-svelte/icons/file-text";
</script>

<Seo
    title="Resume | Atrey Desai"
    description="Resume of Atrey Desai - undergraduate researcher and AI enthusiast."
/>

<div class="layout-main py-8 md:py-12">
    <div class="flex items-center justify-between mb-8">
        <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100">
            resume
        </h1>

        <a
            href="/resume.pdf"
            download="Atrey_Desai_Resume.pdf"
            class="btn-primary inline-flex items-center gap-2 transition-all duration-300 hover:-translate-y-0.5"
        >
            <Download size={16} />
            Download PDF
        </a>
    </div>

    <p class="text-ink-600 dark:text-cream-400 mb-8">
        A one-page summary of my experience, skills, and education. For a more
        comprehensive overview, see my <a href="/cv" class="link">CV</a>.
    </p>

    <!-- PDF Embed -->
    <div class="bg-cream-50 dark:bg-ink-800 rounded-lg p-8 text-center">
        <FileText
            size={64}
            class="mx-auto mb-4 text-ink-300 dark:text-ink-600"
        />
        <p class="text-ink-600 dark:text-cream-400 mb-4">
            [PDF Embed Placeholder]
        </p>
        <p class="text-sm text-ink-500 dark:text-ink-400">
            Place your <code class="bg-cream-200 dark:bg-ink-700 px-1 rounded"
                >resume.pdf</code
            >
            in the
            <code class="bg-cream-200 dark:bg-ink-700 px-1 rounded"
                >static/</code
            > folder.
        </p>
    </div>
</div>
