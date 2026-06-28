<script lang="ts">
  import { page } from "$app/stores";
  import DarkModeToggle from "./DarkModeToggle.svelte";

  const links = [
    { name: "about", href: "/about/" },
    { name: "research", href: "/research/" },
    { name: "cv", href: "/cv/" },
    { name: "blog", href: "/blog/" },
    { name: "photography", href: "/photography/" },
    { name: "bookshelf", href: "/bookshelf/" },
  ];

  const pageLabels: Record<string, string> = {
    about: "about",
    research: "research",
    cv: "cv",
    resume: "resume",
    photography: "photography",
    blog: "blog",
    bookshelf: "bookshelf",
  };

  $: currentPath = $page.url.pathname;
  $: currentSegment = currentPath.split("/").filter(Boolean)[0] ?? "";
  $: currentLabel = currentSegment ? pageLabels[currentSegment] ?? currentSegment : "";

  function isActive(href: string, pathname: string): boolean {
    const normalizedHref = href === "/" ? href : href.replace(/\/$/, "");
    const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
    return (
      normalizedPath === normalizedHref ||
      normalizedPath.startsWith(`${normalizedHref}/`)
    );
  }
</script>

<header class="layout-main w-full pt-7 md:pt-8" data-sveltekit-preload-code="eager">
  <div class="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between md:gap-6">
    <nav
      aria-label="Breadcrumb"
      class="flex min-w-0 shrink-0 items-center font-mono text-sm leading-none text-ink-700 dark:text-cream-300"
    >
      <a
        href="/"
        class="font-display text-base font-bold leading-none text-ink-900 transition-colors duration-200 hover:text-accent-dark dark:text-cream-100 dark:hover:text-accent"
      >
        atrey desai
      </a>
      {#if currentLabel}
        <span class="mx-2 text-xs leading-none text-ink-400 dark:text-ink-600" aria-hidden="true">/</span>
        <span class="text-xs leading-none text-ink-900 dark:text-cream-100">{currentLabel}</span>
      {/if}
    </nav>

    <div class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:flex md:w-auto md:items-center">
      <nav
        aria-label="Site pages"
        class="min-w-0 font-mono text-xs leading-7"
      >
        {#each links as link, i (link.href)}
          {@const active = isActive(link.href, currentPath)}
          {#if i > 0}
            <span class="mx-1.5 text-ink-400 dark:text-ink-600" aria-hidden="true">·</span>
          {/if}
          <a
            href={link.href}
            aria-current={active ? "page" : undefined}
            class="whitespace-nowrap transition-colors duration-200 {active ? 'text-accent-dark dark:text-accent-dark' : 'text-ink-500 hover:text-accent-dark dark:text-cream-400 dark:hover:text-accent'}"
          >
            {link.name}
          </a>
        {/each}
      </nav>
      <DarkModeToggle />
    </div>
  </div>
</header>
