<script lang="ts">
    import { goto } from "$app/navigation";
    import type { ScriptWithCharacters } from "$lib/resources/common/gameData.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    type LocalSlot = { number: number; claimed: boolean; playerName: string | null };

    // svelte-ignore state_referenced_locally
    let slots = $state<LocalSlot[]>(data.session.slots.map(s => ({ ...s })));
    let script = $state<ScriptWithCharacters | null>(null);

    $effect(() => {
        fetch(`/api/scripts/${data.session.scriptId}`).then(r => r.ok ? r.json() : null).then(s => { script = s; });
    });

    const charById = $derived(new Map((script?.characters ?? []).map(c => [c.id, c])));

    let activeNumber = $state<number | null>(null);
    let activeCharacterId = $state<string | null>(null);
    let nameInput = $state('');
    let revealing = $state(false);
    let confirming = $state(false);
    let finishing = $state(false);

    function focusOnMount(node: HTMLInputElement) {
        node.focus();
    }

    const allDone = $derived(slots.every(s => s.claimed));

    async function tapNumber(number: number) {
        const slot = slots.find(s => s.number === number);
        if (!slot || slot.claimed) return;

        revealing = true;
        activeNumber = number;
        nameInput = '';
        try {
            const res = await fetch(`/api/clock/${data.clockid}/draw/reveal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number })
            });
            if (!res.ok) {
                alert('Failed to reveal this token.');
                activeNumber = null;
                return;
            }
            const body = await res.json();
            activeCharacterId = body.characterId;
        } finally {
            revealing = false;
        }
    }

    function closeModal() {
        activeNumber = null;
        activeCharacterId = null;
        nameInput = '';
    }

    async function confirmName() {
        if (activeNumber === null) return;
        confirming = true;
        try {
            const res = await fetch(`/api/clock/${data.clockid}/draw/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: activeNumber, playerName: nameInput.trim() || null })
            });
            if (!res.ok) {
                alert('Failed to confirm your name.');
                return;
            }
            const slot = slots.find(s => s.number === activeNumber);
            if (slot) { slot.claimed = true; slot.playerName = nameInput.trim() || null; }
            closeModal();
        } finally {
            confirming = false;
        }
    }

    async function finishSetup() {
        finishing = true;
        try {
            const res = await fetch(`/api/clock/${data.clockid}/draw/finish`, { method: 'POST' });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                alert(`Failed to finish setup: ${body?.error ?? 'Unknown error'}`);
                return;
            }
            localStorage.setItem(`grimoire-locked-${data.clockid}`, 'true');
            goto(`/admin/${data.clockid}/grim`);
        } finally {
            finishing = false;
        }
    }
</script>

<style>
    .draw-main {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding: 1.5em;
        gap: 1.5em;
        text-align: center;
    }

    .draw-instructions {
        opacity: 0.8;
        max-width: 32em;
    }

    .number-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
        gap: 1em;
        width: 100%;
        max-width: 40em;
    }

    .number-btn {
        aspect-ratio: 1 / 1;
        border-radius: 50%;
        font-size: 1.8em;
        font-weight: bold;
        border: none;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    .number-btn:disabled {
        background-color: #2a2a2a;
        color: #666;
        cursor: default;
    }

    .modal-overlay {
        position: fixed;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0,0,0,0.9);
        z-index: 100;
    }

    .rules-text {
        font-style: italic;
        text-align: center;
        opacity: 0.85;
    }

    .name-input {
        width: 100%;
        box-sizing: border-box;
        text-align: center;
        font-size: 1.1em;
        padding: 0.6em 0.8em;
        margin-top: 0.5em;
    }

    .modal-panel {
        background: var(--theme-bg-secondary);
        padding: 1.5em;
        border-radius: 1em;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1em;
        width: min(90vw, 360px);
        box-sizing: border-box;
    }
</style>

<div class="draw-main">
    <h1>Draw your character</h1>
    <p class="draw-instructions">Pass this phone around the table. Each player taps a number, secretly views their character, and enters their name. Then pass it to the next player.</p>

    <div class="number-grid">
        {#each slots as slot (slot.number)}
            <button class="number-btn" disabled={slot.claimed} onclick={() => tapNumber(slot.number)}>
                {slot.claimed ? '✓' : slot.number}
            </button>
        {/each}
    </div>

    <button class="button-style highlight" disabled={!allDone || finishing} onclick={finishSetup}>
        {finishing ? 'Finishing…' : 'Finish Setup'}
    </button>
</div>

{#if activeNumber !== null}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-overlay" role="dialog" tabindex="0">
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="modal-panel" onclick={(e) => e.stopPropagation()}>
            {#if revealing || !activeCharacterId}
                <div>Revealing…</div>
            {:else}
                {@const character = charById.get(activeCharacterId)}
                {#if character}
                    <div style="width: 160px; height: 160px; position: relative;">
                        <CharacterToken {character} size="160px" norules />
                    </div>
                    <div class="rules-text">{character.rules}</div>
                {:else}
                    <div>Unknown character</div>
                {/if}
                <input type="text" class="input-style name-input" placeholder="Your name (optional)" bind:value={nameInput} use:focusOnMount onkeydown={(e) => { if (e.key === 'Enter') confirmName(); }}/>
                <div style="display: flex; gap: 1em;">
                    <button class="button-style" onclick={closeModal} disabled={confirming}>Cancel</button>
                    <button class="button-style highlight" onclick={confirmName} disabled={confirming}>Confirm</button>
                </div>
            {/if}
        </div>
    </div>
{/if}
