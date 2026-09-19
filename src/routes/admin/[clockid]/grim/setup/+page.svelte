<script lang="ts">
    import { goto } from "$app/navigation";
    import { CHARACTER_CATEGORIES, type Preset, type ScriptCharacter, type ScriptWithCharacters } from "$lib/resources/common/gameData.js";
    import { newGrimoireStateHistory } from "$lib/resources/common/grimoireState.js";
    import { getPlayerCount } from "$lib/common/util.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    const tokenSize = '110px';

    type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;
    let step = $state<Step>(1);
    let selectedScript = $state<ScriptWithCharacters | null>(null);
    let playerCount = $state<number | null>(null);
    let chosenCharacterIds = $state<string[]>([]);
    let bluffIds = $state<string[]>([]);
    let extraSeatFor = $state<Record<string, string>>({});
    let presets = $state<Preset[]>([]);
    let loadingPresets = $state(false);
    let submitting = $state(false);

    const charById = $derived(new Map((selectedScript?.characters ?? []).map(c => [c.id, c])));

    const chosenCharacters = $derived(chosenCharacterIds.map(id => charById.get(id)).filter((c): c is ScriptCharacter => !!c));
    const expectedCounts = $derived(getPlayerCount(playerCount ?? 5));
    const currentCounts = $derived({
        townsfolk: chosenCharacters.filter(c => c.category === 'townsfolk').length,
        outsiders: chosenCharacters.filter(c => c.category === 'outsider').length,
        minions: chosenCharacters.filter(c => c.category === 'minion').length,
        demons: chosenCharacters.filter(c => c.category === 'demon').length
    });

    const categoryWarnings = $derived(
        ([
            ['townsfolk', 'townsfolk'],
            ['outsiders', 'outsiders'],
            ['minions', 'minions'],
            ['demons', 'demons']
        ] as const)
            .filter(([key]) => currentCounts[key] > expectedCounts[key])
            .map(([key, label]) => `Too many ${label}: ${currentCounts[key]} selected, ${expectedCounts[key]} expected.`)
    );

    const zeroCountChars = $derived(chosenCharacters.filter(c => c.player_count === 0));
    const pendingZeroChar = $derived(zeroCountChars.find(c => !extraSeatFor[c.id]));
    const extraSeatCharacterIds = $derived(zeroCountChars.map(c => extraSeatFor[c.id]).filter((id): id is string => !!id));

    const seatCharacterIds = $derived([
        ...chosenCharacterIds.filter(id => (charById.get(id)?.player_count ?? 1) > 0),
        ...extraSeatCharacterIds
    ]);
    const allCharacterIds = $derived([...chosenCharacterIds, ...extraSeatCharacterIds]);

    const matchingPresets = $derived(presets.filter(p =>
        p.character_ids.filter(id => (charById.get(id)?.player_count ?? 1) > 0).length === playerCount
    ));

    async function chooseScript(script: ScriptWithCharacters) {
        selectedScript = script;
        playerCount = null;
        resetSelection();
        presets = [];
        step = 2;
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

    function resetSelection() {
        chosenCharacterIds = [];
        bluffIds = [];
        extraSeatFor = {};
    }

    function choosePlayerCount(n: number) {
        playerCount = n;
        resetSelection();
        step = 3;
    }

    function applyPreset(preset: Preset) {
        chosenCharacterIds = [...preset.character_ids];
        bluffIds = [...preset.bluff_ids];
        extraSeatFor = {};
        step = 7;
    }

    function startNewGame() {
        resetSelection();
        step = 4;
    }

    $effect(() => {
        if (step === 3 && !loadingPresets && matchingPresets.length === 0) startNewGame();
    });

    function toggleCharacter(characterId: string) {
        if (chosenCharacterIds.includes(characterId)) {
            chosenCharacterIds = chosenCharacterIds.filter(id => id !== characterId);
        } else if (chosenCharacterIds.length < (playerCount ?? 0)) {
            chosenCharacterIds = [...chosenCharacterIds, characterId];
        }
    }

    function finishCharacters() {
        extraSeatFor = {};
        step = zeroCountChars.length === 0 ? 6 : 5;
    }

    function chooseExtra(characterId: string) {
        if (!pendingZeroChar) return;
        extraSeatFor[pendingZeroChar.id] = characterId;
        if (!zeroCountChars.some(c => !extraSeatFor[c.id])) step = 6;
    }

    function toggleBluff(characterId: string) {
        if (bluffIds.includes(characterId)) {
            bluffIds = bluffIds.filter(id => id !== characterId);
        } else if (bluffIds.length < 3) {
            bluffIds = [...bluffIds, characterId];
        }
    }

    async function drawTokens() {
        if (!selectedScript) return;
        submitting = true;
        try {
            const res = await fetch(`/api/clock/${data.clockid}/draw`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scriptId: selectedScript.id, characterIds: seatCharacterIds, bluffIds })
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
        if (!selectedScript) return;
        submitting = true;
        try {
            const history = newGrimoireStateHistory(data.clockid, selectedScript.id);
            history.loadedPreset = { character_ids: allCharacterIds, bluff_ids: bluffIds };
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

    .player-count-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(4em, 1fr));
        gap: 0.5em;
    }
    .player-count-grid button {
        padding: 0.8em 0;
        font-size: 1.1em;
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

    .token-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5em;
    }

    .token-wrapper {
        position: relative;
        width: var(--token-size);
        height: var(--token-size);
        cursor: pointer;
    }

    .token-wrapper.disabled {
        cursor: not-allowed;
    }

    .tick {
        position: absolute;
        inset: 15%;
        width: 70%;
        height: 70%;
        pointer-events: none;
        filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.8));
    }

    .section {
        background: var(--theme-bg-secondary);
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
    }

    .character-counts-table td, .character-counts-table th {
        padding: 0.1em 0.4em;
        text-align: center;
    }

    .over {
        color: #f59e0b;
        font-weight: bold;
    }

    .warning {
        margin-top: 0.5em;
        color: #f59e0b;
    }

    .zero-count-row {
        display: flex;
        align-items: center;
        gap: 1em;
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

<div class="setup-main" style="--token-size: {tokenSize}" ondragstart={(e) => e.preventDefault()} role="presentation">
    <div class="setup-header">
        <a href="/admin/{data.clockid}/grim" class="button-style">← Back</a>
        <h1 style="margin: 0; font-size: 1.2em;">Setup new game</h1>
        <div class="setup-steps">
            <span class:active={step === 1}>1. Script</span>
            <span>›</span>
            <span class:active={step === 2}>2. Players</span>
            <span>›</span>
            <span class:active={step === 3}>3. Preset</span>
            <span>›</span>
            <span class:active={step === 4}>4. Characters</span>
            <span>›</span>
            <span class:active={step === 5}>5. Extras</span>
            <span>›</span>
            <span class:active={step === 6}>6. Bluffs</span>
            <span>›</span>
            <span class:active={step === 7}>7. Finish</span>
        </div>
    </div>

    {#snippet tokenGrid(chars: ScriptCharacter[], isSelected: (c: ScriptCharacter) => boolean, onpick: (c: ScriptCharacter) => void, isDisabled: (c: ScriptCharacter) => boolean)}
        {#each CHARACTER_CATEGORIES as category}
            {@const inCategory = chars.filter(c => c.category === category)}
            {#if inCategory.length > 0}
                <h3 style="margin: 0.5em 0 0.3em;">{category}</h3>
                <div class="token-list">
                    {#each inCategory as character (character.id)}
                        {@const selected = isSelected(character)}
                        {@const disabled = !selected && isDisabled(character)}
                        <div class="token-wrapper" class:disabled onclick={() => !disabled && onpick(character)} role="button" tabindex="0" onkeydown={() => {}}>
                            <CharacterToken {character} size={tokenSize} norules style="opacity: {selected ? 0.4 : disabled ? 0.3 : 1} !important;" />
                            {#if selected}
                                <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="4,13 10,19 20,6" />
                                </svg>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        {/each}
    {/snippet}

    <div class="setup-body">
        {#if step === 1}
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
        {:else if step === 2 && selectedScript}
            <div class="script-picker">
                <div class="script-picker-header">
                    <h2 style="margin: 0;">How Many Players?</h2>
                    <button class="button-style" onclick={() => step = 1}>← Back</button>
                </div>
                <div style="font-style: italic; opacity: 0.6; margin-top: -0.5em;">Excluding travellers, these should be added after the grim setup</div>
                <div class="player-count-grid">
                    {#each { length: 11 } as _, i}
                        <button class="button-style" class:highlight={playerCount === i + 5} onclick={() => choosePlayerCount(i + 5)}>{i + 5}</button>
                    {/each}
                </div>
            </div>
        {:else if step === 3 && selectedScript}
            <div class="section preset-list">
                <h2 style="margin-top: 0;">Presets for {playerCount} players</h2>
                {#if loadingPresets}
                    <div style="opacity: 0.6;">Loading…</div>
                {:else if matchingPresets.length === 0}
                    <div style="opacity: 0.6;">No presets for this script and player count.</div>
                {:else}
                    {#each matchingPresets as p (p.id)}
                        <button class="button-style" style="text-align: left;" onclick={() => applyPreset(p)}>{p.name}</button>
                    {/each}
                {/if}
                <button class="button-style highlight" onclick={startNewGame}>New Game</button>
            </div>
            <div class="footer-actions">
                <button class="button-style" onclick={() => step = 2}>← Back</button>
            </div>
        {:else if step === 4 && selectedScript}
            <div class="section">
                <table class="character-counts-table">
                    <thead>
                        <tr><th></th><th>Chosen</th><th>T</th><th>O</th><th>M</th><th>D</th></tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="opacity: 0.5;">Target</td>
                            <td>{playerCount}</td>
                            <td>{expectedCounts.townsfolk}</td>
                            <td>{expectedCounts.outsiders}</td>
                            <td>{expectedCounts.minions}</td>
                            <td>{expectedCounts.demons}</td>
                        </tr>
                        <tr>
                            <td style="opacity: 0.5;">Current</td>
                            <td>{chosenCharacterIds.length}</td>
                            <td class:over={currentCounts.townsfolk > expectedCounts.townsfolk}>{currentCounts.townsfolk}</td>
                            <td class:over={currentCounts.outsiders > expectedCounts.outsiders}>{currentCounts.outsiders}</td>
                            <td class:over={currentCounts.minions > expectedCounts.minions}>{currentCounts.minions}</td>
                            <td class:over={currentCounts.demons > expectedCounts.demons}>{currentCounts.demons}</td>
                        </tr>
                    </tbody>
                </table>
                {#each categoryWarnings as warning}
                    <div class="warning">⚠ {warning}</div>
                {/each}
            </div>
            <div class="section">
                {@render tokenGrid(
                    selectedScript.characters,
                    c => chosenCharacterIds.includes(c.id),
                    c => toggleCharacter(c.id),
                    () => chosenCharacterIds.length >= (playerCount ?? 0)
                )}
            </div>
            <div class="footer-actions">
                <button class="button-style" onclick={() => step = matchingPresets.length === 0 ? 2 : 3}>← Back</button>
                <button class="button-style highlight" disabled={chosenCharacterIds.length !== playerCount} onclick={finishCharacters}>Next →</button>
            </div>
        {:else if step === 5 && selectedScript}
            {#if pendingZeroChar}
                <div class="section">
                    <div class="zero-count-row">
                        <div style="width: 80px; height: 80px; position: relative;">
                            <CharacterToken character={pendingZeroChar} size="80px" norules />
                        </div>
                        <div>
                            <strong>{pendingZeroChar.name}</strong> doesn't take a seat. Choose an extra character to fill it
                            ({extraSeatCharacterIds.length + 1} of {zeroCountChars.length}).
                        </div>
                    </div>
                </div>
                <div class="section">
                    {@render tokenGrid(
                        selectedScript.characters.filter(c => c.player_count !== 0 && !chosenCharacterIds.includes(c.id) && !extraSeatCharacterIds.includes(c.id)),
                        () => false,
                        c => chooseExtra(c.id),
                        () => false
                    )}
                </div>
            {/if}
            <div class="footer-actions">
                <button class="button-style" onclick={() => { extraSeatFor = {}; step = 4; }}>← Back</button>
            </div>
        {:else if step === 6 && selectedScript}
            <div class="section">
                <h2 style="margin-top: 0;">Choose 3 bluffs ({bluffIds.length}/3)</h2>
                {@render tokenGrid(
                    selectedScript.characters.filter(c => !allCharacterIds.includes(c.id)),
                    c => bluffIds.includes(c.id),
                    c => toggleBluff(c.id),
                    () => bluffIds.length >= 3
                )}
            </div>
            <div class="footer-actions">
                <button class="button-style" onclick={() => { extraSeatFor = {}; step = 4; }}>← Back</button>
                <button class="button-style highlight" disabled={bluffIds.length !== 3} onclick={() => step = 7}>Next →</button>
            </div>
        {:else if step === 7 && selectedScript}
            <div class="section">
                <h2 style="margin-top: 0;">Ready to seat {seatCharacterIds.length} player{seatCharacterIds.length === 1 ? '' : 's'}</h2>
                <p>Choose how to assign characters to players.</p>
            </div>
            <div class="finish-choices">
                <button class="button-style highlight" disabled={submitting} onclick={drawTokens}>Draw tokens</button>
                <button class="button-style" disabled={submitting} onclick={goStraightToGrim}>Go straight to grim view</button>
            </div>
            <div class="footer-actions">
                <button class="button-style" onclick={() => step = 3}>← Back</button>
            </div>
        {/if}
    </div>
</div>
