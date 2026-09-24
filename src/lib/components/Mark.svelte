<script lang="ts">
    // The drawn caret or separator from $lib/marks. A caret turns open by
    // itself inside an element with aria-expanded="true", or a <summary>
    // whose <details> is open, so it needs no state of its own.
    import { markHtml, type MarkKind } from "$lib/marks";

    export let kind: MarkKind = "dot";
    export let text: string = kind === "dot" ? "·" : "";
</script>

{@html markHtml(kind, text)}
