<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";
  import ResearchCard from "$lib/components/ResearchCard.svelte";
  import LegoImage from "$lib/components/LegoImage.svelte";
  import { ArrowRight } from "@jis3r/icons";
  import { Github, Twitter, GraduationCap, Mail } from "lucide-svelte";
  import { fly, fade } from "svelte/transition";
  import { papersData, homepageData } from "$lib/content";
  import ScrollReveal from "$lib/components/ScrollReveal.svelte";
  import HyperText from "$lib/components/HyperText.svelte";

  // Get featured papers for the preview section, sorted by priority (lower = first)
  $: featuredPapers = papersData.papers
    .filter((p) => p.featured)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, 3);

  // Email reveal with animation
  let emailRevealed = false;

  function revealEmail() {
    emailRevealed = true;
  }

  // Helper to parse markdown-style links in text
  function parseLinks(text: string): string {
    // Convert **text** to <strong>text</strong>
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Convert *text* to <span class="emphasized">text</span>
    text = text.replace(
      /\*([^*]+)\*/g,
      '<span class="text-ink-900 dark:text-cream-100">$1</span>',
    );
    // Convert [text](url) to <a href="url" class="link">text</a>
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
  description="Atrey Desai - undergraduate researcher at University of Maryland studying NLP, AI safety, and computational linguistics. Research on benchmark evaluation, multimodal reasoning, and animal vocalizations."
  url="https://atreydesai.com"
/>

<div class="layout-main py-8 md:py-12">
  <!-- Hero Section -->
  <section class="mb-16">
    <div class="flex flex-col md:flex-row items-start gap-8">
      <!-- Left Column: Image + Social Links -->
      <div class="w-full md:w-1/3 flex-shrink-0">
        <!-- Profile Image with Lego Effect -->
        <div
          class="aspect-square w-full max-w-[300px] mx-auto md:mx-0 rounded-lg overflow-hidden mb-6"
        >
          <LegoImage
            src="/images/profile.JPG"
            alt="Atrey Desai"
            blockSize={48}
          />
        </div>

        <!-- Social Links (moved from footer) -->
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

          <!-- Email with animated click to reveal -->
          <div class="flex items-center space-x-3">
            <span
              class="text-ink-600 dark:text-cream-400 transition-transform duration-300"
              class:translate-y-0={!emailRevealed}
              class:-translate-y-0.5={emailRevealed}
            >
              <Mail size={18} />
            </span>
            {#if emailRevealed}
              <a
                href="mailto:{homepageData.social.email}"
                class="text-sm text-accent dark:text-accent-light hover:text-accent-dark transition-all duration-300"
                in:fly={{ x: -10, duration: 300 }}
              >
                {homepageData.social.email}
              </a>
            {:else}
              <button
                type="button"
                on:click={revealEmail}
                class="text-sm text-ink-500 dark:text-ink-400 hover:text-accent dark:hover:text-accent-light transition-all duration-300 cursor-pointer underline underline-offset-2 decoration-dotted"
              >
                click to reveal
              </button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Right Column: Introduction -->
      <div class="flex-1">
        <h1
          class="heading-display text-3xl md:text-4xl text-ink-900 dark:text-cream-100 mb-4"
        >
          hey, i'm <HyperText text="atrey desai." />
        </h1>

        <div class="space-y-4 text-ink-700 dark:text-cream-300">
          {#each homepageData.intro as paragraph}
            <p class="text-base leading-relaxed">
              {@html parseLinks(paragraph)}
            </p>
          {/each}

          <div class="text-base">
            <p class="mb-1">
              <span class="text-ink-500 dark:text-ink-400"
                >research interests:</span
              >
              {@html parseLinks(homepageData.researchInterests.intro)}
            </p>
            <ol
              class="list-decimal list-inside space-y-0.5 ml-4 text-sm text-ink-600 dark:text-cream-400"
            >
              {#each homepageData.researchInterests.items as item}
                <li>{@html parseLinks(item)}</li>
              {/each}
            </ol>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Divider -->
  <hr class="border-dotted border-ink-200 dark:border-ink-700 my-8" />

  <!-- Research Preview Section -->
  <ScrollReveal animation="fade-up" delay={100}>
    <section class="mb-12">
      <div class="flex items-center justify-between mb-6">
        <h2 class="section-heading mb-0">research</h2>
        <a
          href="/research"
          class="link-subtle inline-flex items-center gap-1 text-sm"
        >
          see all
          <ArrowRight size={14} />
        </a>
      </div>

      <div class="space-y-2 stagger-children">
        {#each featuredPapers as paper (paper.id)}
          <ResearchCard {paper} />
        {/each}
      </div>
    </section>
  </ScrollReveal>
</div>
