<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import { Download } from "@jis3r/icons";
</script>

<Seo
    title="Resume | Atrey Desai"
    description="Resume of Atrey Desai - CS & Linguistics student at University of Maryland, researching NLP and AI safety."
    url="https://atreydesai.com/resume"
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
    <div
        class="w-full rounded-lg overflow-hidden shadow-lg border border-cream-200 dark:border-ink-700"
    >
        <iframe
            src="/resume.pdf"
            class="w-full h-[80vh] min-h-[600px]"
            title="Atrey Desai Resume"
        ></iframe>
    </div>
</div>
