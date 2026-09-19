<script lang="ts">
    import { goto } from "$app/navigation";
    import { type Preset, type ScriptWithCharacters } from "$lib/resources/common/gameData.js";
    import { newGrimoireStateHistory } from "$lib/resources/common/grimoireState.js";
    import PresetSummary from "$lib/components/setup/PresetSummary.svelte";
    import BuilderSteps from "$lib/components/setup/BuilderSteps.svelte";
    import { PresetBuilder } from "$lib/components/setup/PresetBuilder.svelte.js";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const STEPS = [
        ['script', 'Script'],
        ['players', 'Players'],
        ['preset', 'Preset'],
        ['tokens', 'Characters'],
        ['extras', 'Extras'],
        ['bluffs', 'Bluffs'],
        ['summary', 'Finish']
    ] as const;

    let step = $state<string>('script');
    const builder = new PresetBuilder();
    let presets = $state<Preset[]>([]);
    let loadingPresets = $state(false);
    let submitting = $state(false);

    const matchingPresets = $derived(presets.filter(p =>
        p.character_ids.filter(id => (builder.charById.get(id)?.player_count ?? 1) > 0).length === builder.playerCount
    ));

    async function chooseScript(script: ScriptWithCharacters) {
        builder.setScript(script);
        presets = [];
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
        builder.loadCharacters(preset.character_ids, preset.bluff_ids);
        step = 'summary';
    }

    function startNewGame() {
        builder.reset();
        step = 'tokens';
    }

    $effect(() => {
        if (step === 'preset' && !loadingPresets && matchingPresets.length === 0) startNewGame();
    });

    async function drawTokens() {
        if (!builder.script) return;
        submitting = true;
        try {
            const res = await fetch(`/api/clock/${data.clockid}/draw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptId: builder.script.id, characterIds: builder.seatCharacterIds, bluffIds: builder.bluffIds })
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
            const history = newGrimoireStateHistory(data.clockid, builder.script.id);
            history.loadedPreset = { character_ids: builder.allCharacterIds, bluff_ids: builder.bluffIds };
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

    .footer-actions {
        display: flex;
        justify-content: space-between;
        gap: 1em;
    }

    .finish-choices {
        display: flex;
        gap: 1em;
        justify-content: center;
        margin-top: 2em;
    }
</style>

<div class="setup-main" ondragstart={(e) => e.preventDefault()} role="presentation">
    <div class="setup-header">
        <a href="/admin/{data.clockid}/grim" class="button-style">← Back</a>
        <h1 style="margin: 0; font-size: 1.2em;">Setup new game</h1>
        <div class="setup-steps">
            {#each STEPS as [key, label], i}
                {#if i > 0}<span>›</span>{/if}
                <span class:active={step === key}>{i + 1}. {label}</span>
            {/each}
        </div>
    </div>

    <div class="setup-body">
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
            <div class="footer-actions">
                <button class="button-style" onclick={() => step = 'players'}>← Back</button>
            </div>
            </div>
        {:else if step === 'summary' && builder.script}
            <div class="script-picker">
            <div class="section">
                <h2 style="margin-top: 0;">Ready to seat {builder.seatCharacterIds.length} player{builder.seatCharacterIds.length === 1 ? '' : 's'}</h2>
                <p>Choose how to assign characters to players.</p>
            </div>
            <div class="finish-choices">
                <button class="button-style highlight" disabled={submitting} onclick={drawTokens}>Draw tokens</button>
                <button class="button-style" disabled={submitting} onclick={goStraightToGrim}>Go straight to grim view</button>
            </div>
            <div class="footer-actions">
                <button class="button-style" onclick={() => step = 'bluffs'}>← Back</button>
            </div>
            </div>
        {:else}
            <BuilderSteps
                {builder}
                {step}
                navigate={(s) => step = s}
                afterPlayers="preset"
                beforeTokens={matchingPresets.length === 0 ? 'players' : 'preset'}
                onBackFromPlayers={() => step = 'script'}
            />
        {/if}
    </div>
</div>
