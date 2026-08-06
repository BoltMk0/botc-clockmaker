<script lang="ts">
    type Props = {
        index: number;
        count: number;
        pillSize?: number;
        onpillclick?:(idx: number)=>void;
        style?: string;
    };

    const {
        index,
        count,
        pillSize = 1,
        onpillclick,
        style
    }: Props = $props();
</script>

<div class="pill-index-display-main" style="--pill-size: {pillSize}em; {style ?? ''}">
    {#each {length: count} as _, i}
        <button class="no-button-style pill-index-display-pill" class:active={index===i} onclick={()=>{onpillclick?.(i)}} title="Slide {i+1}"></button>
    {/each}
</div>

<style>
    .pill-index-display-main{
        display: flex;
        justify-content: center;
        gap: calc(var(--pill-size) / 1.6);
        flex-wrap: nowrap;
        flex-direction: row;
    }

    .pill-index-display-pill {
        width: var(--pill-size);
        height: var(--pill-size);
        border-radius: var(--pill-size);
        background-color: hsl(from var(--theme-bg-tertiary) h s l / 50%);
        transition: background-color 0.5s ease;
    }

    .pill-index-display-pill.active {
        background-color: var(--theme-highlight);
    }
</style>