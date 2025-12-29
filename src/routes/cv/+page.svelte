<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import { Download } from "@jis3r/icons";
    import { FileText } from "lucide-svelte";
</script>

<Seo
    title="CV | Atrey Desai"
    description="Curriculum Vitae of Atrey Desai - comprehensive academic and professional history."
/>

<div class="layout-main py-8 md:py-12">
    <div class="flex items-center justify-between mb-8">
        <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100">
            curriculum vitae
        </h1>

        <a
            href="/cv.pdf"
            download="Atrey_Desai_CV.pdf"
            class="btn-primary inline-flex items-center gap-2"
        >
            <Download size={16} />
            Download PDF
        </a>
    </div>

    <p class="text-ink-600 dark:text-cream-400 mb-8">
        A comprehensive overview of my academic and professional history. For a
        condensed version, see my <a href="/resume" class="link">resume</a>.
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
                >cv.pdf</code
            >
            in the
            <code class="bg-cream-200 dark:bg-ink-700 px-1 rounded"
                >static/</code
            > folder.
        </p>
    </div>

    <!-- CV Content Sections -->
    <div class="mt-12 space-y-10 text-serif">
        <section>
            <h2 class="section-heading">education</h2>
            <div class="text-ink-700 dark:text-cream-300">
                <p class="font-medium text-ink-900 dark:text-cream-100">
                    [SCHOOL NAME]
                </p>
                <p>[DEGREE] · Expected [GRADUATION YEAR]</p>
                <p class="text-sm text-ink-500 dark:text-ink-400 mt-1">
                    GPA: [X.XX] · [RELEVANT COURSEWORK OR HONORS]
                </p>
            </div>
        </section>

        <section>
            <h2 class="section-heading">research experience</h2>
            <div class="space-y-6 text-ink-700 dark:text-cream-300">
                <div>
                    <div class="flex justify-between items-start">
                        <p class="font-medium text-ink-900 dark:text-cream-100">
                            [RESEARCH POSITION]
                        </p>
                        <p class="text-sm text-ink-500 dark:text-ink-400">
                            [DATE RANGE]
                        </p>
                    </div>
                    <p>[LAB/GROUP NAME] · [INSTITUTION]</p>
                    <p class="text-sm text-ink-500 dark:text-ink-400 mt-1">
                        Advisor: [ADVISOR NAME]
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>
                            Lorem ipsum dolor sit amet, consectetur adipiscing
                            elit
                        </li>
                        <li>
                            Sed do eiusmod tempor incididunt ut labore et dolore
                            magna aliqua
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <section>
            <h2 class="section-heading">publications</h2>
            <p class="text-ink-600 dark:text-cream-400">
                See the full list on my <a href="/research" class="link"
                    >research page</a
                >.
            </p>
        </section>

        <section>
            <h2 class="section-heading">work experience</h2>
            <div class="space-y-6 text-ink-700 dark:text-cream-300">
                <div>
                    <div class="flex justify-between items-start">
                        <p class="font-medium text-ink-900 dark:text-cream-100">
                            [POSITION]
                        </p>
                        <p class="text-sm text-ink-500 dark:text-ink-400">
                            [DATE RANGE]
                        </p>
                    </div>
                    <p>[ORGANIZATION]</p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        <li>Lorem ipsum dolor sit amet</li>
                        <li>Consectetur adipiscing elit</li>
                    </ul>
                </div>
            </div>
        </section>

        <section>
            <h2 class="section-heading">honors & awards</h2>
            <div class="space-y-2 text-ink-700 dark:text-cream-300">
                <div class="flex justify-between">
                    <span>[AWARD NAME]</span>
                    <span class="text-ink-500 dark:text-ink-400">[YEAR]</span>
                </div>
                <div class="flex justify-between">
                    <span>[AWARD NAME]</span>
                    <span class="text-ink-500 dark:text-ink-400">[YEAR]</span>
                </div>
            </div>
        </section>

        <section>
            <h2 class="section-heading">skills</h2>
            <div class="space-y-2 text-ink-700 dark:text-cream-300 text-sm">
                <p><strong>Programming:</strong> [LANGUAGES]</p>
                <p><strong>Frameworks:</strong> [FRAMEWORKS]</p>
                <p><strong>Tools:</strong> [TOOLS]</p>
                <p><strong>Languages:</strong> [SPOKEN LANGUAGES]</p>
            </div>
        </section>

        <section>
            <h2 class="section-heading">service & leadership</h2>
            <div class="space-y-2 text-ink-700 dark:text-cream-300">
                <div class="flex justify-between">
                    <span>[ROLE] · [ORGANIZATION]</span>
                    <span class="text-ink-500 dark:text-ink-400"
                        >[DATE RANGE]</span
                    >
                </div>
            </div>
        </section>
    </div>
</div>
