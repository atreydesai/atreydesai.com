<script lang="ts">
    // The icon set ships Sun and CloudMoon but no plain Moon, and the style
    // guide says to draw the one missing glyph locally rather than take on a
    // second icon dependency. Traced to match the Sun's 24x24 box and stroke
    // so the two read as a pair in the theme toggle.
    interface IconProps {
        color?: string;
        size?: number;
        strokeWidth?: number;
        class?: string;
    }

    let {
        color = 'currentColor',
        size = 24,
        strokeWidth = 2,
        class: className = ''
    }: IconProps = $props();
</script>

<div class={className} aria-hidden="true">
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        stroke-width={strokeWidth}
        stroke-linecap="round"
        stroke-linejoin="round"
    >
        <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
    </svg>
</div>

<style>
    div {
        display: inline-block;
    }
</style>
