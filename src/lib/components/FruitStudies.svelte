<script lang="ts">
    import { onMount } from "svelte";

    let frame: HTMLIFrameElement;
    let height = 1100;

    function syncTheme() {
        const style = getComputedStyle(document.documentElement);
        const tokens = Object.fromEntries(
            ["--font-prose", "--font-mono", "--radius-control", "--radius-media", "--motion-fast", "--focus-ring"]
                .map((name) => [name, style.getPropertyValue(name).trim()])
        );
        frame?.contentWindow?.postMessage({
            type: "fruit-studies:theme",
            dark: document.documentElement.classList.contains("dark"),
            tokens,
        }, "*");
    }

    onMount(() => {
        function receiveSize(event: MessageEvent) {
            if (event.source !== frame?.contentWindow || event.data?.type !== "fruit-studies:resize") return;
            const next = event.data.height;
            if (typeof next === "number" && Number.isFinite(next) && next > 0) {
                height = Math.min(6000, Math.max(300, Math.ceil(next)));
            }
        }
        window.addEventListener("message", receiveSize);
        const observer = new MutationObserver(syncTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        syncTheme();
        return () => {
            window.removeEventListener("message", receiveSize);
            observer.disconnect();
        };
    });
</script>

<div class="fruit-studies">
    <iframe
        bind:this={frame}
        src="/interactive/fruit-studies/index.html"
        title="Interactive pointillist fruit collection"
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
        loading="lazy"
        on:load={syncTheme}
        style:height="{height}px"
    ></iframe>
</div>

<style>
    .fruit-studies {
        margin: var(--space-8) 0;
        width: 100%;
    }
    iframe {
        display: block;
        width: 100%;
        border: 0;
    }
</style>
