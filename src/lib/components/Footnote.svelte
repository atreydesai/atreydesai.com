<script lang="ts">
    export let number: number;
    export let content: string;
</script>

<sup
    class="footnote-ref cursor-pointer text-accent hover:text-accent-dark transition-colors"
    >[{number}]</sup
>

<style>
    .footnote-ref {
        font-size: 0.75rem;
        line-height: 1;
        vertical-align: super;
    }
</style>
