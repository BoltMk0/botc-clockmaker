<script lang="ts">
    import { getNewClocktowerThemeContext } from "../../../model/theme";
    import BuntingFlag from "./BuntingFlag.svelte";

    let {
        width,
        height,
        rotation = 0,
        style = '',
        density = 0.6
    }: {
        width: number|string;
        height: number|string;
        rotation?: number;
        style?: string;
        density?: number;
    } = $props();


    const FLAG_WIDTH_TO_HEIGHT_RATIO = 0.7;

    let clientWidth: number = $state(0);
    let clientHeight: number = $state(0);

    const theme = getNewClocktowerThemeContext();

    const densityClamped = $derived(Math.max(0, Math.min(1, density)));

    const flagWidth = $derived(clientHeight * FLAG_WIDTH_TO_HEIGHT_RATIO);

    const numBunting = $derived(clientWidth && flagWidth ? Math.ceil(clientWidth / flagWidth / (1 + 2 * (1-densityClamped))) : 0);
</script>

<svg bind:clientWidth={clientWidth} bind:clientHeight={clientHeight} width="{width}" height="{height}" preserveAspectRatio="none" style="transform: rotate({rotation}deg); transform-origin: 50% 50%; {style}">
    <line x1=0 y1=0 x2={clientWidth} y2=0 stroke={theme.baseSecondary} stroke-width="2"/>
    {#each Array(numBunting) as _, i}
    <BuntingFlag color={`hsl(from ${theme.buntingColorBase} calc(h - 15 + ${((i+2)%3) * 30}) calc(30 + s - ${((i+2)%3) * 20}) calc(${27 + theme.skyBrightness *12} + l * ${((i+2) % 3) * 0.3}))`} x={(i+0.5) * (clientWidth/(numBunting+0.5))} y={1} width={flagWidth} height={clientHeight} flapDelay={(i * 0.37) % 3.1} flapDuration={2.6 + (i % 3) * 0.4}/>
    {/each}
</svg>