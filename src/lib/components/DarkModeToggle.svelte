<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Sun, CloudMoon } from "@jis3r/icons";

    let isDark = false;

    onMount(() => {
        const savedTheme = localStorage.getItem("theme");
        isDark = savedTheme === "dark";
        updateTheme();
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
        <CloudMoon size={18} />
    {/if}
</button>
