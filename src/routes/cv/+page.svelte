<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import { Download } from "@jis3r/icons";
    import cvYaml from "../../content/cv.yaml";

    import type { PageData } from './$types';
    export let data: PageData;

    interface CvExperience {
        organization: string;
        dates: string;
        role: string;
        advisors?: string;
        bullets: string[];
    }

    interface Cv {
        education: {
            school: string;
            degree: string;
            advisors_html: string;
            coursework_html: string;
        };
        experience: CvExperience[];
        publications: {
            groups: { heading: string; items: string[] }[];
            note_html: string;
        };
        awards: { name: string; amount?: string; year: string }[];
        talks: { title: string; venues: { name: string; date: string }[] }[];
        responsibilities: {
            positions: { role_html: string; dates: string; note?: string }[];
            mentorship: { title: string; items: string[] };
        };
        skills: { label: string; items: string }[];
    }

    const cv = cvYaml as unknown as Cv;

    let hoveredDownload = false;
</script>

<PageShell
    title="CV | Atrey Desai"
    description="Curriculum Vitae of Atrey Desai - undergraduate researcher at UMD with experience at Learn Prompting, CLIP Lab, Brown University, and UT Arlington."
    url="https://atreydesai.com/cv/"
>
    <header slot="header" class="page-header page-header-action">
        <h1 class="type-page-title text-ink-900 dark:text-cream-100">
            curriculum vitae
        </h1>

        <a
            href="/cv.pdf"
            download="Atrey_Desai_CV.pdf"
            class="btn-primary inline-flex items-center gap-2"
            on:mouseenter={() => (hoveredDownload = true)}
            on:mouseleave={() => (hoveredDownload = false)}
        >
            <Download size={16} animate={hoveredDownload} />
            Download PDF
        </a>
    </header>

    <p class="deck text-ink-600 dark:text-cream-400 mb-1">
        For a condensed version, see my
        <a href="/resume/" class="link">resume</a>.
    </p>
    {#if data.cvLastUpdated}
        <p class="text-sm italic text-ink-400 dark:text-cream-500 mb-8">
            last updated {data.cvLastUpdated}
        </p>
    {/if}

    <!-- PDF Embed -->
    <div
        class="surface-document w-full border border-cream-200 dark:border-ink-700"
    >
        <iframe
            src="/cv.pdf"
            class="w-full h-[80vh] min-h-[600px]"
            title="Atrey Desai CV"
        ></iframe>
    </div>

    <!-- CV Content Sections -->
    <div class="section-stack mt-12 text-serif">
        <!-- Education -->
        <section>
            <h2 class="section-heading">education</h2>
            <div class="text-ink-700 dark:text-cream-300">
                <p class="font-medium text-ink-900 dark:text-cream-100">
                    {cv.education.school}
                </p>
                <p>{cv.education.degree}</p>
                <p class="text-sm text-ink-500 dark:text-ink-400 mt-1">
                    {@html cv.education.advisors_html}
                </p>
                <p class="text-sm text-ink-500 dark:text-ink-400 mt-1">
                    {@html cv.education.coursework_html}
                </p>
            </div>
        </section>

        <!-- Experience -->
        <section>
            <h2 class="section-heading">experience</h2>
            <div class="space-y-6 text-ink-700 dark:text-cream-300">
                {#each cv.experience as job}
                    <div>
                        <div
                            class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1"
                        >
                            <p
                                class="font-medium text-ink-900 dark:text-cream-100"
                            >
                                {job.organization}
                            </p>
                            <p class="text-sm text-ink-500 dark:text-ink-400">
                                {job.dates}
                            </p>
                        </div>
                        <p class="italic">{job.role}</p>
                        {#if job.advisors}
                            <p class="text-sm text-ink-500 dark:text-ink-400">
                                {job.advisors}
                            </p>
                        {/if}
                        <ul
                            class="list-disc list-inside text-sm mt-2 space-y-1"
                        >
                            {#each job.bullets as bullet}
                                <li>{bullet}</li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Publications -->
        <section>
            <h2 class="section-heading">publications</h2>
            <div class="space-y-6 text-ink-700 dark:text-cream-300">
                {#each cv.publications.groups as group}
                    <div>
                        <h3
                            class="font-medium text-ink-900 dark:text-cream-100 mb-3"
                        >
                            {group.heading}
                        </h3>
                        <ol class="list-decimal list-inside space-y-3 text-sm">
                            {#each group.items as item}
                                <li>{@html item}</li>
                            {/each}
                        </ol>
                    </div>
                {/each}
            </div>
            <p class="text-ink-600 dark:text-cream-400 mt-4">
                {@html cv.publications.note_html}
            </p>
        </section>

        <!-- Honors & Awards -->
        <section>
            <h2 class="section-heading">honors & awards</h2>
            <div class="space-y-2 text-ink-700 dark:text-cream-300">
                {#each cv.awards as award}
                    <div class="flex flex-col sm:flex-row sm:justify-between">
                        <span
                            ><strong>{award.name}</strong>{award.amount
                                ? ` (${award.amount})`
                                : ""}</span
                        >
                        <span class="text-ink-500 dark:text-ink-400"
                            >{award.year}</span
                        >
                    </div>
                {/each}
            </div>
        </section>

        <!-- Talks -->
        <section>
            <h2 class="section-heading">talks</h2>
            <div class="space-y-4 text-ink-700 dark:text-cream-300">
                {#each cv.talks as talk}
                    <div>
                        <p
                            class="font-medium text-ink-900 dark:text-cream-100"
                        >
                            {talk.title}
                        </p>
                        <ul
                            class="list-disc list-inside text-sm mt-2 space-y-1"
                        >
                            {#each talk.venues as venue}
                                <li>
                                    {venue.name} <span
                                        class="text-ink-500 dark:text-ink-400"
                                        >({venue.date})</span
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Professional Responsibilities -->
        <section>
            <h2 class="section-heading">professional responsibilities</h2>
            <div class="space-y-4 text-ink-700 dark:text-cream-300">
                {#each cv.responsibilities.positions as position}
                    {#if position.note}
                        <div>
                            <div
                                class="flex flex-col sm:flex-row sm:justify-between"
                            >
                                <span>{@html position.role_html}</span>
                                <span class="text-ink-500 dark:text-ink-400"
                                    >{position.dates}</span
                                >
                            </div>
                            <p
                                class="text-sm text-ink-500 dark:text-ink-400 italic ml-4"
                            >
                                {position.note}
                            </p>
                        </div>
                    {:else}
                        <div
                            class="flex flex-col sm:flex-row sm:justify-between"
                        >
                            <span>{@html position.role_html}</span>
                            <span class="text-ink-500 dark:text-ink-400"
                                >{position.dates}</span
                            >
                        </div>
                    {/if}
                {/each}
                <div>
                    <p class="font-medium text-ink-900 dark:text-cream-100">
                        {cv.responsibilities.mentorship.title}
                    </p>
                    <ul class="list-disc list-inside text-sm mt-2 space-y-1">
                        {#each cv.responsibilities.mentorship.items as item}
                            <li>{@html item}</li>
                        {/each}
                    </ul>
                </div>
            </div>
        </section>

        <!-- Skills -->
        <section>
            <h2 class="section-heading">skills</h2>
            <div class="space-y-2 text-ink-700 dark:text-cream-300 text-sm">
                {#each cv.skills as skill}
                    <p><strong>{skill.label}:</strong> {skill.items}</p>
                {/each}
            </div>
        </section>
    </div>
</PageShell>
