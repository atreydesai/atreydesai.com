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
  let hoveredSeeAllAbout = false;

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
  <section class="mb-8 md:mb-10">
    <!-- Mobile: flex-col. Desktop: grid with image spanning both rows so icons bottom = image bottom -->
    <div
      class="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,250px)_1fr] md:grid-rows-[1fr_auto]"
    >
      <!-- Image: col 1, spans both rows -->
      <div class="md:row-span-2">
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

      <!-- Text: col 2, row 1 -->
      <div>
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

      <!-- Icons: col 2, row 2 — bottom aligns with image bottom -->
      <div class="-mt-4 flex items-center gap-5">
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

        {#if emailRevealed}
          <a
            href="mailto:{homepageData.social.email}"
            class="flex items-center gap-2 text-sm text-accent dark:text-accent-light hover:text-accent-dark transition-all duration-300"
          >
            <Mail size={20} />
            <span class="inline-flex">
              {#each homepageData.social.email.split("") as char, i}
                <span class="letter-drop" style="animation-delay: {i * 25}ms"
                  >{char === "@" ? "@" : char}</span
                >
              {/each}
            </span>
          </a>
        {:else}
          <button
            type="button"
            on:click={revealEmail}
            title="Reveal email"
            class="flex items-center gap-2 text-ink-500 dark:text-ink-400 hover:text-accent dark:hover:text-accent-light transition-all duration-300 group cursor-pointer"
            aria-label="Reveal email address"
          >
            <Mail
              size={20}
              class="transition-transform duration-300 group-hover:-translate-y-0.5"
            />
            <span class="text-sm underline underline-offset-2 decoration-dotted"
              >click to reveal</span
            >
          </button>
        {/if}
      </div>
    </div>
  </section>

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="mb-8">
      <div class="section-rule mb-6">
        <h2 class="section-heading mb-0">research interests</h2>
        <div class="section-rule-line"></div>
        <a
          href="/about"
          class="link-subtle inline-flex items-center gap-1 text-sm whitespace-nowrap"
          on:mouseenter={() => (hoveredSeeAllAbout = true)}
          on:mouseleave={() => (hoveredSeeAllAbout = false)}
        >
          see more
          <ArrowRight size={14} isHovered={hoveredSeeAllAbout} />
        </a>
      </div>

      <div class="space-y-4 text-ink-700 dark:text-cream-300 max-w-[38rem]">
        <p class="text-base leading-relaxed">
          {@html parseLinks(homepageData.researchInterests.intro)}
        </p>
        <div class="space-y-2 text-base leading-7">
          {#each homepageData.researchInterests.items as item}
            <p>{@html parseLinks(item)}</p>
          {/each}
        </div>
      </div>
    </section>
  </ScrollReveal>

  <ScrollReveal animation="fade-up" delay={60}>
    <section class="mb-8">
      <div class="section-rule mb-6">
        <h2 class="section-heading mb-0">research</h2>
        <div class="section-rule-line"></div>
        <a
          href="/research"
          class="link-subtle inline-flex items-center gap-1 text-sm whitespace-nowrap"
          on:mouseenter={() => (hoveredSeeAll = true)}
          on:mouseleave={() => (hoveredSeeAll = false)}
        >
          see more
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
