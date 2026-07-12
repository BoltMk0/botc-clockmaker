<script lang="ts">
    import { getNewClocktowerThemeContext } from "$lib/components/FullDisplay/NewClocktowerDisplay/model/theme";

    let {
        x,
        y,
        width,
        height,
        numPillars = 6,
        borderX = 2,
        borderY = 2,
        style = ''
    }: {
        x: number;
        y: number;
        width: number;
        height: number;
        numPillars?: number;
        borderX?: number;
        borderY?: number;
        style?: string;
    } = $props();

    const theme = getNewClocktowerThemeContext();
</script>

<svg class='pillar' viewBox="0 0 100 100" x="{x}" y="{y}" width="{width}" height="{height}" preserveAspectRatio="none" style="{style}">
    <polygon points="0,100 0,0 100,0 100,100"/>
    <svg viewBox="0 0 100 100" x="{borderX}" y="{borderY}" width="{100-2*borderX}" height="{100-2*borderY}" preserveAspectRatio="none" style="fill: {theme.baseSecondary}; transition: fill 0.5s ease;">
        {#each {length: numPillars} as _, i}
        <polygon points="{(i*2)*100/(numPillars*2-1)},0 {(i*2)*100/(numPillars*2-1)},100 {(i*2+1)*100/(numPillars*2-1)},100 {(i*2+1)*100/(numPillars*2-1)},0"/>
        {/each}
    </svg>
</svg>

<style>
    svg.pillar {
        transition: fill 0.5s ease;
    }
</style>
