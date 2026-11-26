<script lang="ts">
    // A yellow warning triangle marking a bluff that's in play. Bluffing an in-play character is allowed, so this
    // only points it out to the storyteller; it's never shown on pages the players see.
    import { ICON_VIEWBOX, warningFillIcon } from "$lib/icons/material.js";

    let { size = '24px', style = '', title = 'In play' }: { size?: string; style?: string; title?: string } = $props();
</script>

<!-- Material's warning in yellow, with a dark outline (which also darkens the "!") so it shows on any token. -->
<svg class="in-play-warning" viewBox={ICON_VIEWBOX} width={size} height={size} {style} role="img" aria-label={title}>
    <title>{title}</title>
    <path d={warningFillIcon} fill="#f5c518" stroke="#000" stroke-width="40" stroke-linejoin="round" paint-order="stroke"/>
</svg>

<style>
    .in-play-warning {
        flex-shrink: 0;
        filter: drop-shadow(0 1px 2px #0008);
        pointer-events: auto;
    }
</style>
