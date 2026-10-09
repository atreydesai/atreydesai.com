<script lang="ts">
    // A 2×2 of research settings. Columns run clear → uncertain, rows run
    // static → adapting, so "ce" (uncertain, adapting) is the bottom-right
    // cell. Filled cells mark where a research interest sits.
    import type { QuadrantCell } from "$lib/content";

    export let cells: QuadrantCell[] = [];

    const POSITIONS: Record<QuadrantCell, [number, number]> = {
        sc: [0, 0],
        se: [8, 0],
        cc: [0, 8],
        ce: [8, 8],
    };
    const NAMES: Record<QuadrantCell, string> = {
        sc: "clear and static",
        se: "uncertain and static",
        cc: "clear and adapting",
        ce: "uncertain and adapting",
    };

    $: label = cells.map((c) => NAMES[c]).join("; ");
</script>

<svg class="quadrant-glyph" viewBox="-0.5 -0.5 15 15" role="img" aria-label={label}>
    <title>{label}</title>
    {#each Object.entries(POSITIONS) as [key, [x, y]]}
        <rect
            {x}
            {y}
            width="6"
            height="6"
            rx="0.6"
            class:on={cells.includes(key as QuadrantCell)}
        />
    {/each}
</svg>

<style>
    /* Same riso accent as the interest markers; hard-coded for the same
       reason (documented riso treatment, not ordinary UI). */
    .quadrant-glyph {
        display: inline-block;
        flex: none;
        width: 14px;
        height: 14px;
        overflow: visible;
    }
    rect {
        fill: none;
        stroke: theme("colors.ink.200");
        stroke-width: 1;
    }
    rect.on {
        fill: #e85d4c;
        stroke: #e85d4c;
    }
    :global(.dark) rect {
        stroke: theme("colors.ink.600");
    }
    :global(.dark) rect.on {
        fill: #f07563;
        stroke: #f07563;
    }
</style>
