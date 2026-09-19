<script lang="ts">
    import { goto } from "$app/navigation";
    import { invalidateAll } from "$app/navigation";
    import { CHARACTER_CATEGORIES, presetDisplayName } from "$lib/resources/common/gameData.js";
    import CharacterThumb from "$lib/components/CharacterThumb.svelte";
    import PresetSummary from "$lib/components/setup/PresetSummary.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

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
        background-color: var(--theme-bg-secondary);
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
        overflow-y: auto;
    }

    .character-list {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
    }

    .character-row {
        display: flex;
        align-items: center;
        gap: 0.6em;
        padding: 0.3em 0.5em;
        background-color: var(--theme-bg);
        border-radius: 0.5em;
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
            <div class="character-list">
                {#each CHARACTER_CATEGORIES as category}
                    {@const inCat = data.script.characters.filter(c => c.category === category)}
                    {#if inCat.length > 0}
                        <div style="opacity: 0.6;">{category[0].toUpperCase() + category.slice(1)} ({inCat.length})</div>
                        {#each inCat as character}
                            <div class="character-row">
                                <CharacterThumb {character} />
                                <div>{character.name}</div>
                            </div>
                        {/each}
                    {/if}
                {/each}
            </div>
        </div>
        <div class="panel">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin-top: 0;">Presets</h3>
                <button class="button-style" onclick={createPreset}>+ New Preset</button>
            </div>
            <div class="preset-list">
                {#each data.presets as preset, i (preset.id)}
                    <div class="preset-row">
                        <PresetSummary {preset} characters={data.script.characters} index={i} />
                        <div style="display: flex; gap: 0.4em;">
                            <a class="button-style" href="/settings/scripts/{data.script.id}/presets/{preset.id}">Edit</a>
                            <button class="button-style error" onclick={() => deletePreset(preset.id, presetDisplayName(preset, i))}>Delete</button>
                        </div>
                    </div>
                {:else}
                    <div style="opacity: 0.6;">No presets yet.</div>
                {/each}
            </div>
        </div>
    </div>
</div>
