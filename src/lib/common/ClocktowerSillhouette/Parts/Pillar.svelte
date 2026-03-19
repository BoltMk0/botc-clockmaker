<script lang="ts">
    export let x: number;
    export let y: number;

    export let width: number;
    export let height: number;

    export let numPillars: number = 6;
    export let borderX: number = 2;
    export let borderY: number = 2;

    export let style = "";
</script>


<svg viewBox="0 0 100 100" x="{x}" y="{y}" width="{width}" height="{height}" preserveAspectRatio="none" style="{style}">
    <polygon points="0,100 0,0 100,0 100,100"/>
    <svg viewBox="0 0 100 100" x="{borderX}" y="{borderY}" width="{100-2*borderX}" height="{100-2*borderY}" preserveAspectRatio="none" style="fill: var(--clocktower-color-highlight);">
        {#each {length: numPillars} as _, i}
        <polygon points="{(i*2)*100/(numPillars*2-1)},0 {(i*2)*100/(numPillars*2-1)},100 {(i*2+1)*100/(numPillars*2-1)},100 {(i*2+1)*100/(numPillars*2-1)},0"/>
        {/each}
    </svg>
</svg>