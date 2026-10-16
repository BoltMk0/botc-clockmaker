<script lang="ts">
    import { messageTextParts } from "$lib/common/message";

    // A text element's text, with *asterisked* parts in bold and underlined, and "good" and "evil" in blue and red.
    let { text }: { text: string } = $props();
</script>

{#each messageTextParts(text) as part}{#if part.bold}<strong class={part.alignment}>{part.text}</strong>{:else if part.alignment}<span class={part.alignment}>{part.text}</span>{:else}{part.text}{/if}{/each}

<style>
    strong {
        text-decoration: underline;
    }

    .good {
        color: #558bdf;
    }

    .evil {
        color: #ca4444;
    }
</style>
