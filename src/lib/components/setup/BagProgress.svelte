<script lang="ts">
    import type { PresetBuilder } from "./PresetBuilder.svelte.js";

    // How many of the chosen tokens will go in the bag, out of one per player. Tokens that stay out of the bag
    // (loric, fabled, the Drunk...) aren't counted.

    let { builder }: { builder: PresetBuilder } = $props();

    const target = $derived(builder.playerCount ?? 0);
    const count = $derived(builder.bagAllowedCount);
    const over = $derived(count > target);
    const kept = $derived(builder.grimOnlyCharacterIds.length);
</script>

<div class="bag-progress" class:over class:done={count === target}>
    <div class="label">
        <span><span class="fraction">{count}/{target}</span> in the bag</span>
        {#if over}
            <span class="note">{count - target} too many</span>
        {:else if kept > 0}
            <span class="note">+{kept} straight to the grim</span>
        {/if}
    </div>
    <div class="track" role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={count} aria-label="Tokens in the bag">
        <div class="fill" style="width: {target > 0 ? Math.min(100, count / target * 100) : 0}%;"></div>
    </div>
</div>

<style>
    .bag-progress {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
    }
    .label {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 1em;
    }
    .fraction {
        font-size: 1.2em;
        font-weight: 600;
    }
    .note {
        font-size: 0.85em;
        opacity: 0.7;
    }
    .track {
        height: 0.5em;
        border-radius: 999px;
        background: var(--theme-bg-tertiary);
        overflow: hidden;
    }
    .fill {
        height: 100%;
        border-radius: inherit;
        background: var(--theme-highlight);
        transition: width 0.15s, background-color 0.15s;
    }
    .done .fill {
        background: #22c55e;
    }
    .over .fill {
        background: #f59e0b;
    }
    .over .note {
        color: #f59e0b;
        opacity: 1;
    }
</style>
