<script lang="ts">
    import type { Preset } from "$lib/resources/common/gameData.js";

    let { preset }: { preset: Pick<Preset, 'good_victories' | 'evil_victories'> } = $props();

    const played = $derived(preset.good_victories + preset.evil_victories);
    const goodPercent = $derived(Math.round(preset.good_victories / played * 100));
</script>

<span class="preset-stats">
    Played {played} {played === 1 ? 'time' : 'times'}
    {#if played >= 2}
        · Good {goodPercent}% / Evil {100 - goodPercent}%
    {/if}
</span>

<style>
    .preset-stats {
        font-size: 0.8em;
        opacity: 0.7;
    }
</style>
