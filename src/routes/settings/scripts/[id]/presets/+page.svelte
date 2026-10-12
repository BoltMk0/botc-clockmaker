<script lang="ts">
    import { invalidateAll } from "$app/navigation";
    import { presetDisplayName, presetPlayerCount, type Preset } from "$lib/resources/common/gameData.js";
    import PresetSummary from "$lib/components/setup/PresetSummary.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // Grouped by player count (number of chosen characters), ascending. `index` is the
    // preset's position in the unsorted list so default names stay stable.
    const presetGroups = $derived.by(() => {
        const groups = new Map<number, { preset: Preset; index: number }[]>();
        data.presets.forEach((preset: Preset, index: number) => {
            const count = presetPlayerCount(preset, data.script.characters);
            groups.set(count, [...(groups.get(count) ?? []), { preset, index }]);
        });
        return [...groups.entries()]
            .sort(([a], [b]) => a - b)
            .map(([playerCount, presets]) => ({ playerCount, presets }));
    });

    async function deletePreset(presetId: string, name: string) {
        if (!confirm(`Delete preset "${name}"? This cannot be undone.`)) return;
        try {
            const response = await fetch(`/api/presets/${presetId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`${response.status}`);
            invalidateAll();
        } catch (er) {
            alert(`Failed to delete preset: ${er}`);
        }
    }
</script>

<style>
    .presets-main {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        grid-template-columns: minmax(0, 1fr);
        gap: 1em;
        overflow: hidden;
    }

    .presets-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1em;
    }
    .presets-header .button-style {
        white-space: nowrap;
    }
    .title {
        display: flex;
        align-items: center;
        gap: 0.6em;
        min-width: 0;
    }
    .title-swatch {
        width: 1.5em;
        height: 1.5em;
        border-radius: 50%;
        flex-shrink: 0;
    }
    .title h2 {
        margin: 0;
        font-size: 2.2rem;
    }

    /* Phones: Back and New Preset share the top row, with the title on its own row beneath them. */
    @media (max-width: 560px) {
        .presets-header {
            display: grid;
            grid-template-columns: auto auto;
            grid-template-areas: "back new" "title title";
            gap: 0.75em;
        }
        .presets-header .back {
            grid-area: back;
            justify-self: start;
        }
        .presets-header .new {
            grid-area: new;
            justify-self: end;
        }
        .title {
            grid-area: title;
        }
        .title h2 {
            font-size: 1.6rem;
        }
    }

    .panel {
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
        overflow-y: auto;
    }

    .group-heading {
        margin: 0.8em 0 0.3em;
        font-size: 1em;
        opacity: 0.7;
    }
    .group-heading:first-child {
        margin-top: 0;
    }

    .preset-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5em;
        padding: 0.5em;
        background-color: var(--theme-bg);
        border-radius: 0.5em;
    }

    .preset-list {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
    }
</style>

<div class="presets-main padded">
    <div class="presets-header">
        <a class="button-style back" href="/settings/scripts/{data.script.id}">← Back</a>
        <div class="title">
            <div class="title-swatch" style="background-color: {data.script.hue};"></div>
            <h2>{data.script.name} Presets</h2>
        </div>
        <a class="button-style new" href="/settings/scripts/{data.script.id}/presets/new">+ New Preset</a>
    </div>
    <div class="panel">
        {#each presetGroups as group (group.playerCount)}
            <h3 class="group-heading">{group.playerCount} players ({group.presets.length})</h3>
            <div class="preset-list">
                {#each group.presets as { preset, index } (preset.id)}
                    <div class="preset-row">
                        <PresetSummary {preset} characters={data.script.characters} {index} />
                        <div style="display: flex; gap: 0.4em;">
                            <a class="button-style" href="/settings/scripts/{data.script.id}/presets/{preset.id}">Edit</a>
                            <button class="button-style error" onclick={() => deletePreset(preset.id, presetDisplayName(preset, index))}>Delete</button>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div style="opacity: 0.6;">No presets yet.</div>
        {/each}
    </div>
</div>
