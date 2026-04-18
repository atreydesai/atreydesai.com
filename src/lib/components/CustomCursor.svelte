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

        const updateHoverState = (x: number, y: number) => {
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            isHovering = !!el?.closest?.(HOVER_SELECTOR);
        };

        const handleMouseMove = (e: MouseEvent) => {
            targetX = e.clientX;
            targetY = e.clientY;
            updateHoverState(e.clientX, e.clientY);
        };

        // Animation loop for cursor movement
        let animationId: number;
        const animate = () => {
            // Instant cursor position (no delay)
            cursorX = targetX;
            cursorY = targetY;

            if (cursorElement) {
                cursorElement.style.transform = `translate(${cursorX - 10}px, ${cursorY - 10}px)`;
            }

            animationId = requestAnimationFrame(animate);
        };

        document.addEventListener("mousemove", handleMouseMove);
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
