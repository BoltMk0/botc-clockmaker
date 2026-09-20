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

    // iOS Safari only raises the keyboard for focus() calls made synchronously inside a user gesture.
    // The real name input only mounts after the reveal fetch resolves, so we focus this always-mounted
    // proxy input during the tap, then hand focus to the real input once it exists (the keyboard stays up).
    let keyboardProxy = $state<HTMLInputElement | null>(null);

    function focusOnMount(node: HTMLInputElement) {
        node.focus();
    }

    // iOS Safari doesn't shrink the layout viewport when the keyboard opens, so a fixed full-screen overlay
    // ends up half hidden. Track the visual viewport (the area actually visible) and fit the overlay to it.
    let visibleArea = $state<{ top: number; height: number } | null>(null);

    $effect(() => {
        if (activeNumber === null) return;
        const vv = window.visualViewport;
        if (!vv) return;
        const update = () => { visibleArea = { top: vv.offsetTop, height: vv.height }; };
        update();
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
            visibleArea = null;
        };
    });

    const allDone = $derived(slots.every(s => s.claimed));

    // Once the last character is drawn, keep Finish Setup disabled for 5s so the device gets handed back first
    let finishEnabled = $state(false);

    $effect(() => {
        if (!allDone) return;
        finishEnabled = false;
        const timer = setTimeout(() => { finishEnabled = true; }, 5000);
        return () => clearTimeout(timer);
    });

    async function tapNumber(number: number) {
        const slot = slots.find(s => s.number === number);
        if (!slot || slot.claimed) return;

        keyboardProxy?.focus();
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
                keyboardProxy?.blur();
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
        if (activeNumber === null || !nameInput.trim()) return;
        confirming = true;
        try {
            const res = await fetch(`/api/clock/${data.clockid}/draw/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: activeNumber, playerName: nameInput.trim() })
            });
            if (!res.ok) {
                alert('Failed to confirm your name.');
                return;
            }
            const slot = slots.find(s => s.number === activeNumber);
            if (slot) { slot.claimed = true; slot.playerName = nameInput.trim(); }
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

    .keyboard-proxy {
        position: fixed;
        top: 0;
        left: 0;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
        font-size: 16px; /* avoids iOS zoom-on-focus */
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
        overflow-y: auto;
        background: rgba(0,0,0,0.9);
        z-index: 100;
    }

    .rules-text {
        font-style: italic;
        text-align: center;
        opacity: 0.85;
    }

    .name-row {
        display: flex;
        --name-row-height: 3em;
        align-items: stretch;
        height: var(--name-row-height);
        width: 100%;
        margin-top: 0.5em;
        border-radius: 0.5em;
    }

    .name-row:focus-within {
        box-shadow: 0 0 0 2px #2f7de1;
    }

    .name-input:focus {
        outline: none;
    }

    .name-input {
        flex: 1;
        min-width: 0;
        box-sizing: border-box;
        text-align: center;
        font-size: 1.1em;
        padding: 0.6em 0.8em;
        border-radius: 0.5em 0 0 0.5em;
    }

    .tick-btn {
        flex: none;
        width: var(--name-row-height);
        padding: 0;
        border: 1px solid #2f7de1;
        border-radius: 0 0.5em 0.5em 0;
        background-color: #2f7de1;
        color: white;
        font-size: 1.1em;
        font-weight: bold;
        cursor: pointer;
    }

    .tick-btn:disabled {
        opacity: 0.4;
        cursor: default;
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
        margin: auto; /* centres, but stays scrollable when the visible area is short */
    }
</style>

<input bind:this={keyboardProxy} class="keyboard-proxy" type="text" aria-hidden="true" tabindex="-1" autocomplete="off"/>

<div class="draw-main">
    {#if !allDone}
        <h1 class="dumbledore-font">Draw your character</h1>
        <p class="draw-instructions">Pass this phone around the table. Each player taps a number, secretly views their character, and enters their name. Then pass it to the next player.</p>

        <div class="number-grid">
            {#each slots as slot (slot.number)}
                <button class="number-btn" disabled={slot.claimed} onclick={() => tapNumber(slot.number)}>
                    {slot.claimed ? '✓' : slot.number}
                </button>
            {/each}
        </div>
    {:else}
        <h1 class="dumbledore-font">Please return this device to the storyteller</h1>
        <button class="button-style highlight" disabled={finishing || !finishEnabled} onclick={finishSetup}>
            {finishing ? 'Finishing…' : 'Finish Setup'}
        </button>
    {/if}
</div>

{#if activeNumber !== null}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="modal-overlay" role="dialog" tabindex="0" style={visibleArea ? `inset: auto 0 auto 0; top: ${visibleArea.top}px; height: ${visibleArea.height}px;` : ''}>
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
                <div class="name-row">
                    <input type="text" class="input-style name-input" placeholder="Your name" bind:value={nameInput} use:focusOnMount onkeydown={(e) => { if (e.key === 'Enter') confirmName(); }}/>
                    <button class="tick-btn" aria-label="Confirm" onclick={confirmName} disabled={confirming || !nameInput.trim()}>✓</button>
                </div>
            {/if}
        </div>
    </div>
{/if}
