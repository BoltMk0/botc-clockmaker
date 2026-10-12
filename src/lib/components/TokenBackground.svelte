<script lang="ts">
    import type { Snippet } from 'svelte';

    let { style = '', size = '200px', children }: { style?: string; size?: string; children?: Snippet } = $props();
</script>

<div class="token-background-main" style="--token-size: {size}; {style};">
    {@render children?.()}
</div>

<style>
    .token-background-main {
        width: var(--token-size);
        height: var(--token-size);
        box-sizing: border-box;
        color-scheme: only light;
        position: relative;
        border-radius: 50%;
        aspect-ratio: 1 / 1;
        background-color: #e0cfcf;
        color: black;
        box-shadow:
        inset 0 calc(var(--token-size) * -0.02) calc(var(--token-size) * 0.2) calc(var(--token-size) * 0.05) #997f7f,
        inset 0 calc(var(--token-size) * 0.03) calc(var(--token-size) * 0.05) calc(var(--token-size) * 0.025) #FFF8,
        inset 0 0 calc(var(--token-size) * 0.025) calc(var(--token-size) * 0.03) black;
        overflow: hidden;
    }
</style>
