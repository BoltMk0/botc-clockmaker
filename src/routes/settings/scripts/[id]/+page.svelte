<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { arrowBackIcon, downloadIcon, editIcon, visibilityIcon } from "$lib/icons/material.js";
    import { invalidateAll } from "$app/navigation";
    import { presetDisplayName, presetPlayerCount, type PresetListEntry } from "$lib/resources/common/gameData.js";
    import PresetSummary from "$lib/components/setup/PresetSummary.svelte";
    import TokenPicker from "$lib/components/setup/TokenPicker.svelte";
    import { PresetBuilder } from "$lib/components/setup/PresetBuilder.svelte.js";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    // The characters are shown as a preset's are, from a builder holding just the script (and none of the
    // travellers, loric and fabled from the rest of the library).
    const builder = new PresetBuilder();
    $effect.pre(() => { builder.script = data.script; });

    // Grouped by player count, ascending. `index` is the preset's position in the unsorted list so default names stay stable.
    const presetGroups = $derived.by(() => {
        const groups = new Map<number, { preset: PresetListEntry; index: number }[]>();
        data.presets.forEach((preset, index) => {
            const count = presetPlayerCount(preset);
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
    .script-main {
        width: 100%;
        height: 100%;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        /* Keeps wide content (e.g. the buttons) from stretching the page past the screen's width. */
        grid-template-columns: minmax(0, 1fr);
        gap: 1em;
        overflow: hidden;
    }

    .title-row {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        align-items: center;
        gap: 0.6em;
    }
    .title-row .back {
        justify-self: start;
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

    .script-scroll {
        overflow-y: auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
        gap: 1.5em;
        /* Room for the panels' shadows. */
        padding-bottom: 1em;
    }
    /* Kept narrow and centred on wide screens; the scrollbar stays at the page's edge. */
    .script-scroll > section {
        width: 100%;
        max-width: 50em;
        margin: 0 auto;
    }

    /* The settings pages' panel card. */
    .panel {
        --surface: var(--theme-bg-secondary);
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
    }

    .page-actions {
        justify-self: end;
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 0.5em;
    }

    /* Each section's button sits at the end of its title's row. */
    .section-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 0.5em 1em;
        margin-bottom: 1em;
    }
    .section-header h3 {
        margin: 0;
    }

    .group-heading {
        margin: 0.8em 0 0.3em;
        font-size: 1em;
        opacity: 0.7;
    }
    .group-heading:first-of-type {
        margin-top: 0;
    }

    .preset-list {
        display: flex;
        flex-direction: column;
        gap: 0.3em;
    }

    .preset-row {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5em;
        padding: 0.5em;
        background-color: var(--theme-bg);
        border-radius: 0.5em;
    }
    .preset-row:hover {
        background-color: var(--theme-bg-tertiary);
    }
    .row-link {
        position: absolute;
        inset: 0;
        border-radius: inherit;
    }
    .row-link:focus-visible {
        outline: 2px solid var(--theme-highlight);
        outline-offset: 2px;
    }
    .preset-row .delete {
        position: relative;
        flex-shrink: 0;
    }

    @media (max-width: 560px) {
        .title-row {
            grid-template-columns: auto minmax(0, 1fr);
        }
        /* Phones: the buttons get their own row under Back and the title. */
        .page-actions {
            grid-column: 1 / -1;
            justify-self: start;
            justify-content: flex-start;
        }
        .title h2 {
            font-size: 1.6rem;
        }
        .panel {
            padding: 1rem;
        }
    }
</style>

<div class="script-main padded">
    <div class="title-row">
        <a class="button-style back" href="/settings/scripts"><MaterialIcon icon={arrowBackIcon} size="1.2em"/> Back</a>
        <div class="title">
            <div class="title-swatch" style="background-color: {data.script.hue};"></div>
            <h2>{data.script.name}</h2>
        </div>
        <div class="page-actions">
            <a class="button-style" href="/script/{data.script.id}?backUrl=/settings/scripts/{data.script.id}"><MaterialIcon icon={visibilityIcon} size="1.2em"/> View Script</a>
            <a class="button-style" href="/api/scripts/{data.script.id}/export" download><MaterialIcon icon={downloadIcon} size="1.2em"/> Export</a>
        </div>
    </div>
    <div class="script-scroll">
        <section class="panel">
            <div class="section-header">
                <h3>Characters ({data.script.characters.length})</h3>
                <a class="button-style highlight" href="/settings/scripts/{data.script.id}/characters"><MaterialIcon icon={editIcon} size="1.2em"/> Edit</a>
            </div>
            <TokenPicker {builder} readonly showAll />
        </section>
        <section class="panel" id="presets">
            <div class="section-header">
                <h3>Presets ({data.presets.length})</h3>
                <a class="button-style highlight" href="/settings/scripts/{data.script.id}/presets/new">+ New Preset</a>
            </div>
            {#each presetGroups as group (group.playerCount)}
                <h4 class="group-heading">{group.playerCount} players ({group.presets.length})</h4>
                <div class="preset-list">
                    {#each group.presets as { preset, index } (preset.id)}
                        <div class="preset-row">
                            <!-- Covers the whole row, so clicking anywhere on it opens the preset; Delete sits above it. -->
                            <a class="row-link" href="/settings/scripts/{data.script.id}/presets/{preset.id}" aria-label="Edit {presetDisplayName(preset, index)}"></a>
                            <PresetSummary {preset} characters={data.script.characters} {index} lastPlayed={preset.last_played} />
                            <button class="button-style error delete" onclick={() => deletePreset(preset.id, presetDisplayName(preset, index))}>Delete</button>
                        </div>
                    {/each}
                </div>
            {:else}
                <div style="opacity: 0.6;">No presets yet.</div>
            {/each}
        </section>
    </div>
</div>
