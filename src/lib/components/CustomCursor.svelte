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

        const handleMouseMove = (e: MouseEvent) => {
            targetX = e.clientX;
            targetY = e.clientY;
        };

        const handleMouseEnter = (e: Event) => {
            const target = e.target as HTMLElement;
            if (
                target.tagName === "A" ||
                target.tagName === "BUTTON" ||
                target.closest("a") ||
                target.closest("button") ||
                target.classList.contains("cursor-pointer")
            ) {
                isHovering = true;
            }
        };

        const handleMouseLeave = () => {
            isHovering = false;
        };

        // Animation loop for smooth cursor movement
        let animationId: number;
        const animate = () => {
            // Smooth lerp - faster animation
            cursorX += (targetX - cursorX) * 0.25;
            cursorY += (targetY - cursorY) * 0.25;

            if (cursorElement) {
                cursorElement.style.transform = `translate(${cursorX - 10}px, ${cursorY - 10}px)`;
            }

            animationId = requestAnimationFrame(animate);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseover", handleMouseEnter);
        document.addEventListener("mouseout", handleMouseLeave);
        animate();

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseover", handleMouseEnter);
            document.removeEventListener("mouseout", handleMouseLeave);
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
