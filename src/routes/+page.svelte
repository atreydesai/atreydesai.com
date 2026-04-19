<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";
  import ResearchCard from "$lib/components/ResearchCard.svelte";
  import LegoImage from "$lib/components/LegoImage.svelte";
  import { Github, Twitter, GraduationCap, Mail } from "lucide-svelte";
  import { papersData, homepageData } from "$lib/content";
  import ScrollReveal from "$lib/components/ScrollReveal.svelte";
  import HyperText from "$lib/components/HyperText.svelte";

  $: featuredPapers = papersData.papers
    .filter((p) => p.featured)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 3);

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
  <section class="mb-8 md:mb-10">
    <!-- Mobile: flex-col. Desktop: grid with image spanning both rows so icons bottom = image bottom -->
    <div
      class="flex flex-col gap-8 md:grid md:grid-cols-[1fr_minmax(0,250px)] md:grid-rows-[1fr_auto]"
    >
      <!-- Text: col 1, row 1 -->
      <div class="md:col-start-1 md:row-start-1">
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
      </div>

      <!-- Image: col 2, spans both rows -->
      <div class="md:col-start-2 md:row-start-1 md:row-span-2">
        <div
          class="aspect-square w-full max-w-[250px] mx-auto md:mx-0 rounded-lg overflow-hidden"
        >
          <LegoImage
            src="/images/profile.JPG"
            alt="Atrey Desai"
            blockSize={48}
          />
        </div>
      </div>

      <!-- Icons: col 1, row 2 — bottom aligns with image bottom -->
      <div class="md:col-start-1 md:row-start-2 -mt-4 flex items-center gap-5">
        {#each socialLinks as link}
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            title={link.name}
            class="text-ink-500 dark:text-ink-400 hover:text-accent dark:hover:text-accent-light transition-all duration-300 group"
          >
            <svelte:component
              this={link.icon}
              size={20}
              class="transition-transform duration-300 group-hover:-translate-y-0.5"
            />
          </a>
        {/each}

        <a
          href="mailto:{homepageData.social.email}"
          title="Email"
          class="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400 hover:text-accent dark:hover:text-accent-light transition-all duration-300"
        >
          <Mail size={20} class="transition-transform duration-300 group-hover:-translate-y-0.5" />
          <span class="inline-flex">
            {#each homepageData.social.email.split("") as char, i}
              <span class="letter-drop" style="animation-delay: {i * 25}ms">{char}</span>
            {/each}
          </span>
        </a>
      </div>
    </div>
  </section>

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="mb-8">
      <div class="section-rule mb-6">
        <a href="/about" class="section-heading mb-0 hover:text-accent dark:hover:text-accent-light transition-colors duration-200">interests</a>
        <div class="section-rule-line"></div>
      </div>

      <div class="space-y-4 text-ink-700 dark:text-cream-300 max-w-[38rem]">
        <p class="text-base leading-relaxed">
          {@html parseLinks(homepageData.researchInterests.intro)}
        </p>
        <div class="space-y-3 text-base leading-7">
          {#each homepageData.researchInterests.items as item}
            <div>
              <p>{@html parseLinks(item.text)}</p>
              {#if item.citations && item.citations.length > 0}
                <div class="mt-0.5 ml-6 flex gap-1.5 text-xs font-mono text-ink-400 dark:text-cream-500 leading-none">
                  <span class="text-ink-300 dark:text-cream-600">↳</span>
                  {#each item.citations as citation}
                    {#if citation.url}
                      <a
                        href={citation.url}
                        class="hover:text-accent dark:hover:text-accent-light transition-colors duration-150"
                      >[{citation.label}]</a>
                    {:else}
                      <span>[{citation.label}]</span>
                    {/if}
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
        <p class="mt-4 text-xs font-mono text-ink-400 dark:text-cream-500">
          [IP] = in progress
        </p>
      </div>
    </section>
  </ScrollReveal>

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="mb-8">
      <div class="section-rule mb-6">
        <a href="/research" class="section-heading mb-0 hover:text-accent dark:hover:text-accent-light transition-colors duration-200">research highlights</a>
        <div class="section-rule-line"></div>
      </div>

      <div class="space-y-2 stagger-children">
        {#each featuredPapers as paper (paper.id)}
          <ResearchCard {paper} variant="preview" />
        {/each}
      </div>
    </section>
  </ScrollReveal>
</div>

<style>
  .letter-drop {
    display: inline-block;
    opacity: 0;
    animation: letter-drop 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes letter-drop {
    from {
      opacity: 0;
      transform: translateY(-6px) rotate(-4deg);
    }
    to {
      opacity: 1;
      transform: translateY(0) rotate(0deg);
    }
  }
</style>
