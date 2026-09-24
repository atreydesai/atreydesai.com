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

  $: currentPath = $page.url.pathname;

  function isActive(href: string, pathname: string): boolean {
    const normalizedHref = href === "/" ? href : href.replace(/\/$/, "");
    const normalizedPath = pathname === "/" ? pathname : pathname.replace(/\/$/, "");
    return (
      normalizedPath === normalizedHref ||
      normalizedPath.startsWith(`${normalizedHref}/`)
    );
  }
</script>

<header class="page-shell-standard w-full pt-7 md:pt-8" data-sveltekit-preload-code="eager">
  <div class="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between md:gap-6">
    <!-- Just the wordmark: the page's own title and the highlighted nav item
         already say where you are, so a "/ page" crumb here only repeated
         the heading directly beneath it. -->
    <a
      href="/"
      class="w-fit shrink-0 font-display text-base font-bold leading-none text-ink-900 transition-colors duration-200 hover:text-accent-dark dark:text-cream-100 dark:hover:text-accent"
    >
      atrey desai
    </a>

    <div class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:flex md:w-auto md:items-center">
      <nav
        aria-label="Site pages"
        class="type-meta flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1"
      >
        {#each links as link (link.href)}
          {@const active = isActive(link.href, currentPath)}
          <a
            href={link.href}
            aria-current={active ? "page" : undefined}
            class="whitespace-nowrap transition-colors duration-200 {active ? 'text-accent-dark dark:text-accent-light' : 'text-ink-500 hover:text-accent-dark dark:text-cream-400 dark:hover:text-accent'}"
          >
            {link.name}
          </a>
        {/each}
      </nav>
      <DarkModeToggle />
    </div>
  </div>
</header>
