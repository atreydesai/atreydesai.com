<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    export let src: string;
    export let alt: string = "";
    export let blockSize: number = 12; // Size of each "lego" block

    let canvas: HTMLCanvasElement;
    let container: HTMLDivElement;
    let isHovering = false;
    let animationProgress = 0; // 0 = normal, 1 = fully pixelated
    let animationFrame: number;
    let image: HTMLImageElement;
    let imageLoaded = false;

    const animationDuration = 400; // ms

    onMount(() => {
        if (!browser) return;

        image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            imageLoaded = true;
            if (canvas) {
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                drawImage(0);
            }
        };
        image.src = src;

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    });

    function drawImage(progress: number) {
        if (!canvas || !image || !imageLoaded) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        if (progress === 0) {
            // Draw normal image
            ctx.drawImage(image, 0, 0, width, height);
            return;
        }

        // Calculate current block size based on progress
        const currentBlockSize = Math.max(1, Math.floor(blockSize * progress));

        // Create a temporary small canvas for pixelation
        const tempCanvas = document.createElement("canvas");
        const smallWidth = Math.ceil(width / currentBlockSize);
        const smallHeight = Math.ceil(height / currentBlockSize);
        tempCanvas.width = smallWidth;
        tempCanvas.height = smallHeight;

        const tempCtx = tempCanvas.getContext("2d");
        if (!tempCtx) return;

        // Draw scaled-down image
        tempCtx.drawImage(image, 0, 0, smallWidth, smallHeight);

        // Disable image smoothing for pixelated look
        ctx.imageSmoothingEnabled = false;

        // Clear and draw scaled-up pixelated version
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(tempCanvas, 0, 0, width, height);

        // Draw grid lines for lego effect
        if (progress > 0.5) {
            const gridOpacity = (progress - 0.5) * 0.3;
            ctx.strokeStyle = `rgba(0, 0, 0, ${gridOpacity})`;
            ctx.lineWidth = 1;

            for (let x = 0; x <= width; x += currentBlockSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }

            for (let y = 0; y <= height; y += currentBlockSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
        }
    }

    function animate(
        targetProgress: number,
        startProgress: number,
        startTime: number,
    ) {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // Easing function (ease-out)
        const eased = 1 - Math.pow(1 - progress, 3);

        animationProgress =
            startProgress + (targetProgress - startProgress) * eased;
        drawImage(animationProgress);

        if (progress < 1) {
            animationFrame = requestAnimationFrame(() =>
                animate(targetProgress, startProgress, startTime),
            );
        }
    }

    function handleMouseEnter() {
        isHovering = true;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animate(1, animationProgress, Date.now());
    }

    function handleMouseLeave() {
        isHovering = false;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animate(0, animationProgress, Date.now());
    }
</script>

<div
    class="lego-image-container"
    bind:this={container}
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    role="img"
    aria-label={alt}
>
    <canvas bind:this={canvas} class="lego-canvas" class:loaded={imageLoaded}
    ></canvas>
    {#if !imageLoaded}
        <div class="loading-placeholder">
            <span class="loading-text">Loading...</span>
        </div>
    {/if}
</div>

<style>
    .lego-image-container {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        cursor: pointer;
    }

    .lego-canvas {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        opacity: 0;
        transition: opacity 0.3s ease;
    }

    .lego-canvas.loaded {
        opacity: 1;
    }

    .loading-placeholder {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: theme("colors.cream.200");
    }

    :global(.dark) .loading-placeholder {
        background: theme("colors.ink.800");
    }

    .loading-text {
        font-size: 0.875rem;
        color: theme("colors.ink.400");
    }
</style>
