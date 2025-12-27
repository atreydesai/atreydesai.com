<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import Sun from "lucide-svelte/icons/sun";
    import Moon from "lucide-svelte/icons/moon";

    let isDark = false;

    onMount(() => {
        // Check for saved preference or system preference
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme) {
            isDark = savedTheme === "dark";
        } else {
            isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        updateTheme();

        // Listen for system preference changes
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem("theme")) {
                isDark = e.matches;
                updateTheme();
            }
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    });

    function updateTheme() {
        if (browser) {
            if (isDark) {
                document.documentElement.classList.add("dark");
            } else {
                document.documentElement.classList.remove("dark");
            }
        }
    }

    function toggleTheme() {
        isDark = !isDark;
        localStorage.setItem("theme", isDark ? "dark" : "light");
        updateTheme();
    }
</script>

<button
    type="button"
    on:click={toggleTheme}
    class="p-2 rounded-lg text-ink-600 dark:text-cream-300 hover:bg-cream-200 dark:hover:bg-ink-700 transition-colors"
    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
>
    {#if isDark}
        <Sun size={18} />
    {:else}
        <Moon size={18} />
    {/if}
</button>
