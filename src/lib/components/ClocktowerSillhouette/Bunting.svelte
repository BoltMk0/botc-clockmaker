<script lang="ts">
    import BuntingFlag from "./BuntingFlag.svelte";
    export let width: number|string;
    export let height: number|string;

    export let rotation: number = 0;
    export let style: string = "";
    export let color: string;
    export let density: number = 0.6; // 0 to 1

    let clientWidth: number;
    let clientHeight: number;

    $: densityClamped = Math.max(0, Math.min(1, density));

    $: numBunting = clientWidth && clientHeight ? Math.ceil(clientWidth / clientHeight / (1 + 2 * (1-densityClamped))) : 0;
</script>

<svg bind:clientWidth={clientWidth} bind:clientHeight={clientHeight} width="{width}" height="{height}" preserveAspectRatio="none" style="transform: rotate({rotation}deg); transform-origin: 50% 50%; {style}">
    <line x1=0 y1=0 x2={clientWidth} y2=0 stroke="var(--clocktower-color-base)" stroke-width="2"/>
    {#each Array(numBunting) as _, i}
    <BuntingFlag color={`hsl(from ${color} calc(h - 15 + ${((i+2)%3) * 30}) s calc(30 + l * ${((i+2) % 3) * 0.3}))`} x={(i+0.5) * (clientWidth/(numBunting+0.5))} y={1} width={clientHeight} height={clientHeight}/>
    {/each}
</svg>