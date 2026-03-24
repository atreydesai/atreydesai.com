<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";
  import ResearchCard from "$lib/components/ResearchCard.svelte";
  import LegoImage from "$lib/components/LegoImage.svelte";
  import { ArrowRight } from "@jis3r/icons";
  import { Github, Twitter, GraduationCap, Mail } from "lucide-svelte";
  import { papersData, homepageData } from "$lib/content";
  import ScrollReveal from "$lib/components/ScrollReveal.svelte";
  import HyperText from "$lib/components/HyperText.svelte";

  $: featuredPapers = papersData.papers
    .filter((p) => p.featured)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 3);

  let emailRevealed = false;
  let hoveredSeeAll = false;

  function revealEmail() {
    emailRevealed = true;
  }

  function parseLinks(text: string): string {
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(
      /\*([^*]+)\*/g,
      '<span class="text-ink-900 dark:text-cream-100">$1</span>',
    );
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="link">$1</a>',
    );
    return text;
  }

  const socialLinks = [
    { name: "GitHub", href: homepageData.social.github, icon: Github },
    { name: "Twitter", href: homepageData.social.twitter, icon: Twitter },
    { name: "Scholar", href: homepageData.social.scholar, icon: GraduationCap },
  ];
</script>

<Seo
  title="Atrey Desai"
  description="Atrey Desai - undergraduate researcher at University of Maryland studying NLP, AI safety, and computational linguistics. Research on benchmark evaluation and multimodal reasoning."
  url="https://atreydesai.com"
/>

<div class="layout-main py-8 md:py-12">
  <section class="mb-16 md:mb-20">
    <div class="flex flex-col md:flex-row items-start gap-8">
      <div class="w-full md:w-1/3 flex-shrink-0">
        <div
          class="aspect-square w-full max-w-[300px] mx-auto md:mx-0 rounded-lg overflow-hidden mb-6"
        >
          <LegoImage
            src="/images/profile.JPG"
            alt="Atrey Desai"
            blockSize={48}
          />
        </div>

        <div class="space-y-3 max-w-[300px] mx-auto md:mx-0">
          {#each socialLinks as link}
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center space-x-3 text-ink-600 dark:text-cream-400 hover:text-accent dark:hover:text-accent-light transition-all duration-300 group"
            >
              <svelte:component
                this={link.icon}
                size={18}
                class="transition-transform duration-300 group-hover:-translate-y-0.5"
              />
              <span class="text-sm">@atreydesai</span>
            </a>
          {/each}

          {#if emailRevealed}
            <a
              href="mailto:{homepageData.social.email}"
              class="flex items-center space-x-3 text-sm text-accent dark:text-accent-light hover:text-accent-dark transition-all duration-300"
            >
              <Mail size={18} />
              <span>{homepageData.social.email}</span>
            </a>
          {:else}
            <div class="flex items-center space-x-3">
              <span class="text-ink-600 dark:text-cream-400">
                <Mail size={18} />
              </span>
              <button
                type="button"
                on:click={revealEmail}
                class="text-sm text-ink-500 dark:text-ink-400 hover:text-accent dark:hover:text-accent-light transition-all duration-300 cursor-pointer underline underline-offset-2 decoration-dotted"
                aria-label="Reveal email address"
              >
                click to reveal
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="flex-1">
        <h1
          class="heading-display text-3xl md:text-4xl text-ink-900 dark:text-cream-100 mb-4"
        >
          hey, i'm <HyperText text="atrey desai." />
        </h1>

        <div class="space-y-4 text-ink-700 dark:text-cream-300">
          {#each homepageData.intro as paragraph}
            <p class="text-base leading-relaxed max-w-[38rem]">
              {@html parseLinks(paragraph)}
            </p>
          {/each}
        </div>

        <div class="surface-card mt-8 max-w-[38rem] p-4 md:p-5">
          <p class="meta-label mb-3">Research interests</p>

          <p class="text-base leading-7 text-ink-700 dark:text-cream-300">
            {@html parseLinks(homepageData.researchInterests.intro)}
          </p>

          <div
            class="mt-3 space-y-2 text-base leading-7 text-ink-700 dark:text-cream-300"
          >
            {#each homepageData.researchInterests.items as item}
              <p>{@html parseLinks(item)}</p>
            {/each}
          </div>
        </div>
      </div>
    </div>
  </section>

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="mb-12">
      <div class="section-rule mb-6">
        <h2 class="section-heading mb-0">research</h2>
        <div class="section-rule-line"></div>
        <a
          href="/research"
          class="link-subtle inline-flex items-center gap-1 text-sm whitespace-nowrap"
          on:mouseenter={() => (hoveredSeeAll = true)}
          on:mouseleave={() => (hoveredSeeAll = false)}
        >
          see all
          <ArrowRight size={14} isHovered={hoveredSeeAll} />
        </a>
      </div>

      <div class="space-y-2 stagger-children">
        {#each featuredPapers as paper (paper.id)}
          <ResearchCard {paper} variant="preview" />
        {/each}
      </div>
    </section>
  </ScrollReveal>
</div>
