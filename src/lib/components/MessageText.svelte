<script lang="ts">
    import { boldParts } from "$lib/common/message";

    // A text element's text, with *asterisked* parts in bold.
    let { text }: { text: string } = $props();
</script>

{#each boldParts(text) as part}{#if part.bold}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}
