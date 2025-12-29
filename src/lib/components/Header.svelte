<script lang="ts">
  import { page } from "$app/stores";
  import { onMount } from "svelte";
  import DarkModeToggle from "./DarkModeToggle.svelte";
  import { Menu } from "lucide-svelte";
  import { X } from "@jis3r/icons";

  const links = [
    { name: "About", href: "/about" },
    { name: "Research", href: "/research" },
    { name: "Photography", href: "/photography" },
    { name: "Bookshelf", href: "/bookshelf" },
    { name: "Blog", href: "/blog" },
    { name: "Resume", href: "/resume" },
    { name: "CV", href: "/cv" },
  ];

  let mobileMenuOpen = false;
  let scrolled = false;
  let hoveredLink: string | null = null;

  // Reactive current path - this will update on navigation
  $: currentPath = $page.url.pathname;

  onMount(() => {
    const handleScroll = () => {
      scrolled = window.scrollY > 20;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  });

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  // Close mobile menu on route change
  $: if (currentPath) {
    mobileMenuOpen = false;
  }

  // Determine if a link is active (current page)
  function isActive(href: string, pathname: string): boolean {
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Determine if a link should be raised (active or hovered)
  function shouldRaise(
    href: string,
    pathname: string,
    hovered: string | null,
  ): boolean {
    if (hovered) {
      return hovered === href;
    }
    return isActive(href, pathname);
  }
</script>

<header
  class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
  class:bg-cream-100={scrolled}
  class:dark:bg-ink-900={scrolled}
  class:shadow-sm={scrolled}
  data-sveltekit-noscroll
  data-sveltekit-preload-code="eager"
>
  <div class="layout-container">
    <div class="flex items-center justify-between h-16">
      <!-- Logo / Name -->
      <a
        href="/"
        class="text-xl font-bold text-ink-900 dark:text-cream-100 hover:text-ink-600 dark:hover:text-cream-300 transition-all duration-200"
        on:click={closeMobileMenu}
      >
        atrey desai
      </a>

      <!-- Desktop Navigation -->
      <nav class="hidden md:flex items-center space-x-6">
        {#each links as link (link.href)}
          {@const isLinkActive = isActive(link.href, currentPath)}
          {@const isRaised = shouldRaise(link.href, currentPath, hoveredLink)}
          <a
            href={link.href}
            class="nav-link text-sm transition-all duration-200 ease-out"
            class:text-ink-900={isRaised}
            class:dark:text-cream-100={isRaised}
            class:font-medium={isLinkActive}
            class:-translate-y-0.5={isRaised}
            class:text-ink-500={!isRaised}
            class:dark:text-ink-400={!isRaised}
            on:mouseenter={() => (hoveredLink = link.href)}
            on:mouseleave={() => (hoveredLink = null)}
          >
            {link.name}
          </a>
        {/each}
        <DarkModeToggle />
      </nav>

      <!-- Mobile Menu Button -->
      <div class="flex md:hidden items-center space-x-2">
        <DarkModeToggle />
        <button
          type="button"
          class="p-2 text-ink-600 dark:text-cream-300 hover:text-ink-900 dark:hover:text-cream-100 transition-colors"
          on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {#if mobileMenuOpen}
            <X size={24} />
          {:else}
            <Menu size={24} />
          {/if}
        </button>
      </div>
    </div>

    <!-- Mobile Navigation -->
    {#if mobileMenuOpen}
      <nav
        class="md:hidden py-4 border-t border-ink-200 dark:border-ink-700 animate-fade-in"
      >
        {#each links as link (link.href)}
          {@const isLinkActive = isActive(link.href, currentPath)}
          <a
            href={link.href}
            class="block py-3 transition-all duration-200"
            class:text-ink-900={isLinkActive}
            class:dark:text-cream-100={isLinkActive}
            class:font-medium={isLinkActive}
            class:pl-2={isLinkActive}
            class:text-ink-600={!isLinkActive}
            class:dark:text-cream-300={!isLinkActive}
            on:click={closeMobileMenu}
          >
            {link.name}
          </a>
        {/each}
      </nav>
    {/if}
  </div>
</header>

<!-- Spacer to prevent content from going under fixed header -->
<div class="h-16"></div>

<style>
  .nav-link {
    position: relative;
  }

  .nav-link::after {
    content: "";
    position: absolute;
    bottom: -2px;
    left: 0;
    width: 0;
    height: 1px;
    background-color: currentColor;
    transition: width 0.2s ease-out;
  }

  .nav-link:hover::after,
  .nav-link.-translate-y-0\.5::after {
    width: 100%;
  }
</style>
