<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        title = undefined,
        style = undefined,
        onclick = undefined,
        children
    }: {
        title?: string;
        style?: string;
        onclick?: (ev?: any)=>void;
        children?: Snippet<[]>;
    } = $props();
</script>

<style>
    .audio-mixer-text {
        width: 100%;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        background-color: var(--theme-slider-accent);
        color: #4c6851;
        padding: 4px;
        text-align: center;
        border-radius: 3px;
        box-shadow: 0px 2px 8px 0px #0009 inset;
        border: 3px solid var(--theme-slider-trim);
        text-align: center;
        cursor: pointer;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: clip;
    }
</style>

<button class="audio-mixer-text" style={style} onclick={onclick} title={title}>
    {@render children?.()}
</button>
