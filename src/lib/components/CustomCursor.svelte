<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    let cursorX = 0;
    let cursorY = 0;
    let targetX = 0;
    let targetY = 0;
    let isHovering = false;
    let isVisible = false;
    let cursorElement: HTMLDivElement;

    onMount(() => {
        // Check if device has fine pointer (mouse)
        const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
        if (!hasFinePointer) return;

        isVisible = true;

        const HOVER_SELECTOR = "a, button, .cursor-pointer";

        let lastHitX = -1;
        let lastHitY = -1;

        const handleMouseMove = (e: MouseEvent) => {
            targetX = e.clientX;
            targetY = e.clientY;
        };

        // Animation loop — one layout read per frame at most.
        let animationId: number;
        const animate = () => {
            cursorX = targetX;
            cursorY = targetY;

            if (cursorElement) {
                cursorElement.style.transform = `translate(${cursorX - 10}px, ${cursorY - 10}px)`;
            }

            // Hit-test at most once per frame, and only when the cursor moved.
            if (cursorX !== lastHitX || cursorY !== lastHitY) {
                const el = document.elementFromPoint(cursorX, cursorY) as HTMLElement | null;
                isHovering = !!el?.closest?.(HOVER_SELECTOR);
                lastHitX = cursorX;
                lastHitY = cursorY;
            }

            animationId = requestAnimationFrame(animate);
        };

        document.addEventListener("mousemove", handleMouseMove, { passive: true });
        animate();

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            cancelAnimationFrame(animationId);
        };
    });
</script>

{#if isVisible}
    <div
        bind:this={cursorElement}
        class="custom-cursor"
        class:cursor-hover={isHovering}
        aria-hidden="true"
    ></div>
{/if}
