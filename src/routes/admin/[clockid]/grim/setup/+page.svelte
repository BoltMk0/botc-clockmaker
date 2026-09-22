<script lang="ts">
    import { goto } from "$app/navigation";
    import { alignmentForCategory, bluffSetsOf, presetGrimCharacterIds, presetPlayerCount, type Preset, type ScriptWithCharacters } from "$lib/resources/common/gameData.js";
    import { newGrimoireStateWithTokensAlongTop } from "$lib/resources/common/grimoireState.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import TokenSorter from "$lib/components/setup/TokenSorter.svelte";
    import PresetSummary from "$lib/components/setup/PresetSummary.svelte";
    import BuilderSteps from "$lib/components/setup/BuilderSteps.svelte";
    import CharacterCounts from "$lib/components/setup/CharacterCounts.svelte";
    import { PresetBuilder } from "$lib/components/setup/PresetBuilder.svelte.js";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const STEPS = [
        ['script', 'Script'],
        ['players', 'Players'],
        ['preset', 'Preset'],
        ['tokens', 'Characters'],
        ['bluffs', 'Bluffs'],
        ['summary', 'Finish']
    ] as const;

    let step = $state<string>('script');
    let body = $state<HTMLElement>();

    /** Goes back exactly one step; the script step's back button links to the grim instead. */
    function goBack() {
        const previous: Record<string, string> = {
            players: 'script',
            preset: 'players',
            tokens: matchingPresets.length === 0 ? 'players' : 'preset',
            bluffs: 'tokens',
            summary: 'bluffs'
        };
        if (previous[step]) step = previous[step];
    }

    $effect(() => {
        step;
        body?.scrollTo({ top: 0 });
    });
    const builder = new PresetBuilder();
    let presets = $state<Preset[]>([]);
    let loadingPresets = $state(false);
    let submitting = $state(false);
    let chosenPresetId = $state<string | null>(null);
    let saveAsPreset = $state(true);

    const sameIds = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
    const sameBluffSets = (a: string[][], b: string[][]) => a.length === b.length && sameIds(a.map(s => [...s].sort().join('+')), b.map(s => [...s].sort().join('+')));
    const matchesBuilder = (p: Preset) => sameIds(p.character_ids, builder.chosenCharacterIds)
        && sameIds(presetGrimCharacterIds(p, builder.script?.characters ?? []), builder.grimCharacterIds)
        && sameBluffSets(bluffSetsOf(p), builder.bluffSets);

    // Only credit the chosen preset if the game still matches it (the characters may have been edited since).
    const activePresetId = $derived(presets.find(p => p.id === chosenPresetId && matchesBuilder(p))?.id ?? null);

    // The preset to credit this game to. A game that doesn't use a saved preset is saved as a new one
    // (or matched to an existing identical preset) so its results still get tracked.
    async function resolvePresetId(): Promise<string | null> {
        if (activePresetId) return activePresetId;
        if (!builder.script) return null;
        const existing = presets.find(matchesBuilder);
        if (existing) return existing.id;
        if (!saveAsPreset) return null;
        try {
            const created = await fetch('/api/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script_id: builder.script.id, name: null })
            });
            if (!created.ok) throw new Error(`${created.status}`);
            const preset: Preset = await created.json();
            const saved = await fetch(`/api/presets/${preset.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ character_ids: builder.chosenCharacterIds, grim_character_ids: builder.grimCharacterIds, bluff_sets: builder.bluffSets })
            });
            if (!saved.ok) throw new Error(`${saved.status}`);
            const updated: Preset = await saved.json();
            presets = [...presets, updated];
            return updated.id;
        } catch (er) {
            console.error('Failed to save the setup as a new preset:', er);
            return null;
        }
    }

    const matchingPresets = $derived(presets.filter(p =>
        presetPlayerCount(p, builder.script?.characters ?? []) === builder.playerCount
    ));

    async function chooseScript(script: ScriptWithCharacters) {
        builder.setScript(script);
        presets = [];
        chosenPresetId = null;
        step = 'players';
        loadingPresets = true;
        try {
            const res = await fetch(`/api/presets?script_id=${script.id}`);
            presets = res.ok ? await res.json() : [];
        } catch {
            presets = [];
        } finally {
            loadingPresets = false;
        }
    }

    function applyPreset(preset: Preset) {
        builder.loadCharacters(preset.character_ids, bluffSetsOf(preset), presetGrimCharacterIds(preset, builder.script?.characters ?? []));
        chosenPresetId = preset.id;
        step = 'summary';
    }

    function startNewGame() {
        builder.reset();
        chosenPresetId = null;
        step = 'tokens';
    }

    $effect(() => {
        if (step === 'preset' && !loadingPresets && matchingPresets.length === 0) startNewGame();
    });

    async function drawTokens() {
        if (!builder.script) return;
        submitting = true;
        try {
            const presetId = await resolvePresetId();
            const res = await fetch(`/api/clock/${data.clockid}/draw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptId: builder.script.id, characterIds: builder.bagCharacterIds, bluffSets: builder.bluffSets, offSeatIds: builder.grimCharacterIds, presetId })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                alert(`Failed to start the draw: ${body?.error ?? 'Unknown error'}`);
                return;
            }
            goto(`/admin/${data.clockid}/grim/draw`);
        } finally {
            submitting = false;
        }
    }

    async function goStraightToGrim() {
        if (!builder.script) return;
        submitting = true;
        try {
            const characters = builder.chosenCharacterIds.map(characterId => ({
                characterId,
                alignment: alignmentForCategory(builder.charById.get(characterId)!.category)
            }));
            const history = newGrimoireStateWithTokensAlongTop(data.clockid, builder.script.id, characters);
            history.loadedPreset = { character_ids: builder.chosenCharacterIds, bluff_sets: builder.bluffSets, preset_id: await resolvePresetId() };
            const res = await fetch(`/admin/${data.clockid}/grim/state`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(history)
            });
            if (!res.ok) {
                alert('Failed to save the new game state.');
                return;
            }
            // End of the day with no time remaining; setup may advance the day, so reset it after.
            await fetch(`/api/clock/${data.clockid}/setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: '', duration: 0, ringBellWhenRemaining: null })
            });
            await fetch(`/api/clock/${data.clockid}/day`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day: 0 })
            });
            localStorage.setItem(`grimoire-locked-${data.clockid}`, 'true');
            goto(`/admin/${data.clockid}/grim`);
        } finally {
            submitting = false;
        }
    }
</script>

<style>
    .finish-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4em;
    }

    .setup-main {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding: 1em;
        gap: 1em;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
    }

    .setup-main :global(img),
    .setup-main :global(svg) {
        -webkit-user-drag: none;
    }

    .setup-header {
        display: flex;
        align-items: center;
        gap: 1em;
    }

    .setup-steps {
        display: flex;
        gap: 0.5em;
        opacity: 0.7;
        font-size: 0.9em;
    }

    .setup-steps .active {
        opacity: 1;
        font-weight: bold;
    }

    .setup-steps .compact {
        display: none;
    }

    .toggle {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.7em;
        cursor: pointer;
    }

    .toggle input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
    }

    .toggle-track {
        position: relative;
        flex-shrink: 0;
        width: 2.6em;
        height: 1.5em;
        border-radius: 999px;
        background: var(--theme-bg-tertiary);
        transition: background-color 0.2s ease;
    }

    .toggle-track::after {
        content: '';
        position: absolute;
        top: 0.2em;
        left: 0.2em;
        width: 1.1em;
        height: 1.1em;
        border-radius: 50%;
        background: #FFF;
        transition: transform 0.2s ease;
    }

    .toggle input:checked + .toggle-track {
        background: var(--theme-highlight);
    }

    .toggle input:checked + .toggle-track::after {
        transform: translateX(1.1em);
    }

    .toggle input:focus-visible + .toggle-track {
        outline: 2px solid var(--theme-highlight);
        outline-offset: 2px;
    }

    @media (max-width: 768px) {
        .setup-steps {
            margin-left: auto;
            opacity: 1;
        }

        .setup-steps .full {
            display: none;
        }

        .setup-steps .compact {
            display: inline;
            font-weight: bold;
        }
    }

    .setup-counts {
        flex-shrink: 0;
    }

    .setup-body {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }

    .script-list, .preset-list {
        display: flex;
        flex-direction: column;
        gap: 0.5em;
    }

    .script-picker {
        width: 100%;
        max-width: 40em;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }
    .script-picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1em;
    }

    .script-card {
        border-radius: 10px;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg);
        border-left: 4px solid var(--script-hue);
        overflow: hidden;
        cursor: pointer;
    }
    .script-card:hover {
        background-color: var(--theme-bg);
    }
    .script-card-header {
        display: flex;
        align-items: center;
        gap: 1em;
        padding: 0.8em 1em;
    }
    .script-swatch {
        width: 1.2em;
        height: 1.2em;
        border-radius: 50%;
        background: var(--script-hue);
        flex-shrink: 0;
    }
    .script-title {
        flex: 1;
        min-width: 0;
    }
    .script-name {
        font-weight: 600;
        font-size: 1.05em;
    }
    .script-subtitle {
        font-size: 0.8em;
        opacity: 0.7;
    }

    .section {
        background: var(--theme-bg-secondary);
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
    }

    .finish-choices {
        display: flex;
        gap: 1em;
        justify-content: center;
        margin-top: 2em;
    }

    .finish-choices > button {
        padding: 1.1em 2em;
        font-size: 1.1em;
    }
</style>

{#snippet travellerNote()}
    {#if builder.chosenCharacters.some(c => c.category === 'traveler')}
        <div style="opacity: 0.7; font-size: 0.9em; font-style: italic;">
            Travellers will need to be seated in the grim later. Once in the grim, set the player's name to assign a seat.
        </div>
    {/if}
{/snippet}

<div class="setup-main" ondragstart={(e) => e.preventDefault()} role="presentation">
    <div class="setup-header">
        {#if step === 'script'}
            <a href="/admin/{data.clockid}/grim" class="button-style">← Back</a>
        {:else}
            <button class="button-style" onclick={goBack}>← Back</button>
        {/if}
        <h1 style="margin: 0; font-size: 1.2em;">Setup new game</h1>
        <div class="setup-steps">
            {#each STEPS as [key, label], i}
                {#if i > 0}<span class="full">›</span>{/if}
                <span class="full" class:active={step === key}>{i + 1}. {label}</span>
            {/each}
            {#each STEPS as [key, label], i}
                {#if step === key}<span class="compact">{i + 1} of {STEPS.length}: {label}</span>{/if}
            {/each}
        </div>
    </div>

    {#if step === 'tokens'}
        <div class="setup-counts">
            <CharacterCounts {builder} reversed />
        </div>
    {/if}

    <div class="setup-body" bind:this={body}>
        {#if step === 'script'}
            <div class="script-picker">
            <div class="script-picker-header">
                <h2 style="margin: 0;">Select a Script</h2>
                <a class="button-style" href="/settings/scripts">Configure Scripts</a>
            </div>
            <div class="script-list">
                {#each data.scripts as s (s.id)}
                    <div class="script-card" style="--script-hue: {s.hue};" onclick={() => chooseScript(s)} role="button" tabindex="0" onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') chooseScript(s); }}>
                        <div class="script-card-header">
                            <div class="script-swatch"></div>
                            <div class="script-title">
                                <div class="script-name">{s.name}</div>
                                <div class="script-subtitle">{s.characters.length} character{s.characters.length === 1 ? '' : 's'}</div>
                            </div>
                        </div>
                    </div>
                {:else}
                    <div style="opacity: 0.6;">No scripts available.</div>
                {/each}
            </div>
            </div>
        {:else if step === 'preset' && builder.script}
            <div class="script-picker">
            <div class="section preset-list">
                <h2 style="margin-top: 0;">Presets for {builder.playerCount} players</h2>
                {#if loadingPresets}
                    <div style="opacity: 0.6;">Loading…</div>
                {:else if matchingPresets.length === 0}
                    <div style="opacity: 0.6;">No presets for this script and player count.</div>
                {:else}
                    {#each matchingPresets as p (p.id)}
                        <button class="button-style" style="text-align: left;" onclick={() => applyPreset(p)}><PresetSummary preset={p} characters={builder.script.characters} index={presets.indexOf(p)} /></button>
                    {/each}
                {/if}
                <button class="button-style highlight" onclick={startNewGame}>New Game</button>
            </div>
            </div>
        {:else if step === 'summary' && builder.script}
            <div class="script-picker">
            <div>
                <h2 style="margin-top: 0;">Ready to seat {builder.playerCount} player{builder.playerCount === 1 ? '' : 's'}</h2>
                <p style="font-style: italic;">Choose how to assign characters to players.</p>
            </div>
            {#if builder.surplusCount > 0}
                <div class="section">
                    <TokenSorter {builder}>{@render travellerNote()}</TokenSorter>
                </div>
            {:else}
                {@render travellerNote()}
                <div class="finish-tokens">
                    {#each builder.bagCharacterIds as id, i (id + i)}
                        {@const character = builder.charById.get(id)}
                        {#if character}
                            <CharacterToken {character} size="80px" norules style="position: relative;" />
                        {/if}
                    {/each}
                </div>
                {#if builder.grimCharacterIds.length > 0}
                    <div class="section">
                        <strong>On the grim ({builder.grimCharacterIds.length})</strong>
                        <div class="finish-tokens">
                            {#each builder.grimCharacterIds as id, i (id + i)}
                                {@const character = builder.charById.get(id)}
                                {#if character}
                                    <CharacterToken {character} size="80px" norules style="position: relative;" />
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/if}
            {/if}
            {#if !presets.some(matchesBuilder)}
                <label class="toggle">
                    <input type="checkbox" bind:checked={saveAsPreset} />
                    <span class="toggle-track"></span>
                    Save setup as new preset
                </label>
            {/if}
            <div class="finish-choices">
                <button class="button-style highlight" disabled={submitting || !builder.isSorted} onclick={drawTokens}>Draw tokens</button>
                <button class="button-style" disabled={submitting || !builder.isSorted} onclick={goStraightToGrim}>Go straight to grim view</button>
            </div>
            </div>
        {:else}
            <BuilderSteps
                {builder}
                {step}
                navigate={(s) => step = s}
                afterPlayers="preset"
                hideBack
            />
        {/if}
    </div>
</div>
