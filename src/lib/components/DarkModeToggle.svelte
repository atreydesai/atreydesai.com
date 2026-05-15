<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Sun } from "@jis3r/icons";

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
    class="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-500 dark:text-cream-300 hover:text-ink-900 dark:hover:text-cream-100 transition-colors"
    aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
>
    <Sun size={16} />
</button>
