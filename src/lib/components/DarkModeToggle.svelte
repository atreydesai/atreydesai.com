<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Sun } from "@jis3r/icons";
    import Moon from "./icons/Moon.svelte";

    // Light is the deliberate default: the theme follows a saved choice, not
    // the system appearance. The inline script in app.html applies the same
    // rule before first paint, so this only has to re-read it after hydration.
    let isDark = false;

    onMount(() => {
        const savedTheme = localStorage.getItem("theme");
        isDark = savedTheme === "dark";
        updateTheme();
    });

    function updateTheme() {
        if (!browser) return;
        document.documentElement.classList.toggle("dark", isDark);
        // Keep the browser chrome in step with the page. `color-scheme` rides
        // along with the .dark class in app.css; theme-color has to be set here.
        document
            .querySelector('meta[name="theme-color"]')
            ?.setAttribute("content", isDark ? "#1A1A1A" : "#FDF8F3");
    }

    function toggleTheme() {
        isDark = !isDark;
        localStorage.setItem("theme", isDark ? "dark" : "light");
        updateTheme();
    }
</script>

<!-- The glyph shows the current theme, not the destination: a control whose
     appearance never changes reads as inert. aria-pressed carries the same
     state for assistive tech. -->
<button
    type="button"
    on:click={toggleTheme}
    class="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 dark:text-cream-300 hover:text-ink-900 dark:hover:text-cream-100 transition-colors"
    aria-pressed={isDark}
    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
>
    {#if isDark}
        <Moon size={16} />
    {:else}
        <Sun size={16} />
    {/if}
</button>
