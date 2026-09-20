<script lang="ts">
    import { goto } from "$app/navigation";
    import { invalidateAll } from "$app/navigation";
    import { presetDisplayName, type Preset } from "$lib/resources/common/gameData.js";
    import CharacterList from "$lib/components/CharacterList.svelte";
    import PresetSummary from "$lib/components/setup/PresetSummary.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // Grouped by player count (number of chosen characters), ascending. `index` is the
    // preset's position in the unsorted list so default names stay stable.
    const presetGroups = $derived.by(() => {
        const groups = new Map<number, { preset: Preset; index: number }[]>();
        data.presets.forEach((preset: Preset, index: number) => {
            const count = preset.character_ids.length;
            groups.set(count, [...(groups.get(count) ?? []), { preset, index }]);
        });
        return [...groups.entries()]
            .sort(([a], [b]) => a - b)
            .map(([playerCount, presets]) => ({ playerCount, presets }));
    });

    async function createPreset() {
        try {
            const response = await fetch('/api/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script_id: data.script.id, name: null })
            });
            if (!response.ok) throw new Error(`${response.status}`);
            const preset = await response.json();
            goto(`/settings/scripts/${data.script.id}/presets/${preset.id}`);
        } catch (er) {
            alert(`Failed to create preset: ${er}`);
        }
    }

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
    .scripts-overview-main {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: auto 1fr;
        gap: 1em;
        overflow: hidden;
    }

    .overview-columns {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1em;
        overflow: hidden;
    }

    .panel {
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
        overflow-y: auto;
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

<div class="scripts-overview-main">
    <div style="justify-content: space-between; background-color: var(--theme-bg-secondary); padding: 0.5em 1em;" class="in-a-row padded">
        <button class="button-style" onclick={() => goto('/settings/scripts')}>Back</button>
        <div style="display: flex; align-items: center; gap: 0.5em;">
            <div style="width: 1.5em; height: 1.5em; border-radius: 50%; background-color: {data.script.hue};"></div>
            <h2 style="margin: 0;">{data.script.name}</h2>
        </div>
        <a class="button-style" href="/settings/scripts/{data.script.id}/characters">Edit Characters</a>
    </div>
    <div class="overview-columns padded">
        <div class="panel">
            <h3 style="margin-top: 0;">Characters ({data.script.characters.length})</h3>
            <CharacterList characters={data.script.characters}/>
        </div>
        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin-top: 0;">Presets</h3>
                <button class="button-style" onclick={createPreset}>+ New Preset</button>
            </div>
            <div class="preset-list">
                {#each presetGroups as group (group.playerCount)}
                    <div style="opacity: 0.6; margin-top: 0.4em;">{group.playerCount} players ({group.presets.length})</div>
                    {#each group.presets as { preset, index } (preset.id)}
                        <div class="preset-row">
                            <PresetSummary {preset} characters={data.script.characters} {index} />
                            <div style="display: flex; gap: 0.4em;">
                                <a class="button-style" href="/settings/scripts/{data.script.id}/presets/{preset.id}">Edit</a>
                                <button class="button-style error" onclick={() => deletePreset(preset.id, presetDisplayName(preset, index))}>Delete</button>
                            </div>
                        </div>
                    {/each}
                {:else}
                    <div style="opacity: 0.6;">No presets yet.</div>
                {/each}
            </div>
        </div>
    </div>
</div>
