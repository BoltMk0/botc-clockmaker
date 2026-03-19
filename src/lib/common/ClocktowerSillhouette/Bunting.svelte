<script lang="ts">
    import BuntingFlag from "./BuntingFlag.svelte";
    export let width: number|string;
    export let height: number|string;

    export let numBunting: number = 5;
    export let rotation: number = 0;
    export let style: string = "";
    export let color: string;
</script>

<svg viewBox="0 0 100 50" width="{width}" height="{height}" preserveAspectRatio="none" style="transform: rotate({rotation}deg); transform-origin: 50% 50%; {style}">
    <line x1=0 y1=0 x2=100 y2=0 stroke="var(--clocktower-color-base)" stroke-width="0.5"/>
    {#each Array(numBunting) as _, i}
    <BuntingFlag color={`hsl(from ${color} calc(h + ${(i+2)%3 * 10}) s calc(20 + l * ${((i+1) % 3)/3}))`} x={10 + i * (80/(numBunting))} y={0} width={50/numBunting} height={50}/>
    {/each}
</svg>