<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from '$app/env';
    import { Sun } from "@jis3r/icons";
    import Moon from "./icons/Moon.svelte";

    // Light is the deliberate default: the theme follows a saved choice, not
    // the system appearance. The inline script in app.html applies the same
    // rule before first paint, so this only has to re-read it after hydration.
    let isDark = false;

    let button: HTMLButtonElement;
    /** The cross-fade in progress, if any. */
    let fading: ViewTransition | null = null;

    onMount(() => {
        const savedTheme = localStorage.getItem("theme");
        isDark = savedTheme === "dark";
        updateTheme();

        // While the page cross-fades it is a picture, and a click lands on
        // <html>, not on the button under it: catch a second press on the
        // toggle there, so a quick change of mind isn't lost.
        const pressDuringFade = (event: MouseEvent) => {
            if (!fading || event.target !== document.documentElement) return;
            const r = button.getBoundingClientRect();
            if (event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom) {
                toggleTheme();
            }
        };
        document.addEventListener("click", pressDuringFade, true);
        return () => document.removeEventListener("click", pressDuringFade, true);
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

    // A theme switch restyles every element once. Links and buttons carry
    // colour transitions for hover, though, and a switch set them all off at
    // once: each restyled every frame for 300 ms, most of a phone's main
    // thread for that long, while the rest of the page snapped. So the switch
    // happens with transitions off (app.css, data-theme-switching), and where
    // the browser can, the whole page cross-fades instead, as two pictures
    // the compositor blends: one fade for everything, no per-frame restyles.
    function toggleTheme() {
        const root = document.documentElement;
        // Transitions return once a frame has computed the new colours, so
        // there is no change left for them to animate. That costs a restyle
        // of the page, as the fade's end does; doing both at once makes it one.
        const restoreTransitions = () => delete root.dataset.themeSwitching;
        const swap = async () => {
            root.dataset.themeSwitching = "";
            isDark = !isDark;
            localStorage.setItem("theme", isDark ? "dark" : "light");
            updateTheme();
            await tick();
        };
        const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
        if ("startViewTransition" in document && !reduceMotion) {
            const transition = document.startViewTransition(swap);
            fading = transition;
            void transition.finished.finally(() => {
                if (fading === transition) fading = null;
                restoreTransitions();
            });
        } else {
            void swap().then(() =>
                requestAnimationFrame(() => requestAnimationFrame(restoreTransitions)),
            );
        }
    }
</script>

<!-- The glyph shows the current theme, not the destination: a control whose
     appearance never changes reads as inert. aria-pressed carries the same
     state for assistive tech. -->
<button
    bind:this={button}
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
