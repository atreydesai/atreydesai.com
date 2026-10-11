<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import Mark from "$lib/components/Mark.svelte";
    import { withMarks } from "$lib/marks";
    import { Download } from "@jis3r/icons";
    import cvYaml from "../../content/cv.yaml";

    import type { PageData } from './$types';
    export let data: PageData;

    // organization, role, and advisors each come as plain text or as an
    // `_html` variant (raw HTML, for links) that wins when present. Bullets
    // are raw HTML.
    interface CvExperience {
        organization?: string;
        organization_html?: string;
        dates: string;
        role?: string;
        role_html?: string;
        advisors?: string;
        advisors_html?: string;
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
    heading="curriculum vitae"
>
    <svelte:fragment slot="aside">
        {#if data.cvLastUpdated}
            <span>updated {data.cvLastUpdated}</span>
        {/if}
        <a
            href="/cv.pdf"
            download="Atrey_Desai_CV.pdf"
            class="control-text control-accent"
            on:mouseenter={() => (hoveredDownload = true)}
            on:mouseleave={() => (hoveredDownload = false)}
        >
            <Download size={13} animate={hoveredDownload} />
            Download PDF
        </a>
    </svelte:fragment>

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
    <div class="cv section-stack mt-12 text-serif">
        <!-- Education -->
        <section>
            <h2 class="section-heading">education</h2>
            <div class="text-ink-700 dark:text-cream-300">
                <p data-justify="off" class="cv-ui text-ink-900 dark:text-cream-100">
                    {cv.education.school}
                </p>
                <p data-justify="off" class="cv-ui">
                    {#each cv.education.degree.split(" · ") as part, i}{#if i}{" "}<Mark kind="dot" />{" "}{/if}{part}{/each}
                </p>
                <p class="text-sm text-ink-500 dark:text-cream-500 mt-1">
                    {@html cv.education.advisors_html}
                </p>
                <p class="text-sm text-ink-500 dark:text-cream-500 mt-1">
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
                            <p data-justify="off" class="cv-ui text-ink-900 dark:text-cream-100">
                                {#if job.organization_html}{@html job.organization_html}{:else}{job.organization}{/if}
                            </p>
                            <p
                                class="cv-date shrink-0 whitespace-nowrap text-sm text-ink-500 dark:text-cream-500"
                            >
                                {job.dates}
                            </p>
                        </div>
                        <p data-justify="off" class="cv-ui">
                            {#if job.role_html}{@html job.role_html}{:else}{job.role}{/if}
                        </p>
                        {#if job.advisors_html || job.advisors}
                            <p class="text-sm text-ink-500 dark:text-cream-500">
                                {#if job.advisors_html}{@html job.advisors_html}{:else}{job.advisors}{/if}
                            </p>
                        {/if}
                        <ul
                            class="list-disc list-inside text-sm mt-2 space-y-1"
                        >
                            {#each job.bullets as bullet}
                                <li>{@html bullet}</li>
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
                        <h3 class="cv-ui text-ink-900 dark:text-cream-100 mb-3">
                            {group.heading}
                        </h3>
                        <ol class="list-decimal list-inside space-y-3 text-sm">
                            {#each group.items as item}
                                <li>{@html withMarks(item)}</li>
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
                    <div class="flex flex-col sm:flex-row sm:justify-between gap-x-4">
                        <span class="cv-ui"
                            ><span class="text-ink-900 dark:text-cream-100"
                                >{award.name}</span
                            >{award.amount ? ` (${award.amount})` : ""}</span
                        >
                        <span
                            class="cv-date shrink-0 whitespace-nowrap text-ink-500 dark:text-cream-500"
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
                        <p data-justify="off" class="cv-ui text-ink-900 dark:text-cream-100">
                            {talk.title}
                        </p>
                        <ul
                            class="list-disc list-inside text-sm mt-2 space-y-1"
                        >
                            {#each talk.venues as venue}
                                <li>
                                    {venue.name} <span
                                        class="cv-date text-ink-500 dark:text-cream-500"
                                        >({venue.date})</span
                                    >
                                </li>
                            {/each}
                        </ul>
                    </div>
                {/each}
            </div>
        </section>

        <!-- Service & Leadership -->
        <section>
            <h2 class="section-heading">service & leadership</h2>
            <div class="space-y-4 text-ink-700 dark:text-cream-300">
                {#each cv.responsibilities.positions as position}
                    <div>
                        <div
                            class="flex flex-col sm:flex-row sm:justify-between gap-x-4"
                        >
                            <span class="cv-ui">{@html position.role_html}</span>
                            <span
                                class="cv-date shrink-0 whitespace-nowrap text-ink-500 dark:text-cream-500"
                                >{position.dates}</span
                            >
                        </div>
                        {#if position.note}
                            <p
                                class="text-sm text-ink-500 dark:text-cream-500 italic ml-4"
                            >
                                {position.note}
                            </p>
                        {/if}
                    </div>
                {/each}
                <div>
                    <p data-justify="off" class="cv-ui text-ink-900 dark:text-cream-100">
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
                    <p>
                        <span class="cv-ui text-ink-900 dark:text-cream-100"
                            >{skill.label}:</span
                        >
                        {skill.items}
                    </p>
                {/each}
            </div>
        </section>
    </div>
</PageShell>

<style>
    /* Read vs scan (docs/style-guide.md, Typography). The wrapper sets Optima
       for what you read: bullets, advisor lines, author lists, venues, notes.
       What you scan (organisations, roles, dates, item titles, sub-labels) is
       NHG Text at 400. Nothing is bold: hierarchy comes from family, size, and
       colour. The cv-title / cv-label / cv-date classes also appear inside
       {@html} strings from cv.yaml, so they are :global under .cv. */
    .cv {
        --cv-tracking: -0.005em; /* NHG Text at 16–18px */
    }

    /* 15px detail rows are not tightened. `initial` leaves the var unset, so
       letter-spacing below falls back to inheriting, and a title inside a
       justified line takes that line's tracking like the words around it. */
    .cv .text-sm {
        --cv-tracking: initial;
    }

    .cv-ui,
    .cv :global(.cv-title),
    .cv :global(.cv-label),
    .cv :global(.cv-date) {
        font-family: var(--font-ui);
        font-weight: 400;
        font-variant-numeric: lining-nums;
        letter-spacing: var(--cv-tracking);
    }

    .cv :global(.cv-date) {
        font-variant-numeric: lining-nums tabular-nums;
    }

    .cv :global(.cv-title),
    .cv :global(.cv-label) {
        color: theme("colors.ink.900");
    }

    :global(.dark) .cv :global(.cv-title),
    :global(.dark) .cv :global(.cv-label) {
        color: theme("colors.cream.100");
    }

    /* A linked title keeps the link colour. */
    .cv :global(.link .cv-title) {
        color: inherit;
    }
</style>
