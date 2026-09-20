<script lang="ts">
    import { goto } from "$app/navigation";
    import type { PresetFull } from "$lib/resources/common/gameData.js";
    import PresetStats from "$lib/components/setup/PresetStats.svelte";
    import BuilderSteps from "$lib/components/setup/BuilderSteps.svelte";
    import CharacterList from "$lib/components/CharacterList.svelte";
    import { PresetBuilder } from "$lib/components/setup/PresetBuilder.svelte.js";

    interface Props {
        data: {
            preset: PresetFull | null;
            error?: string;
        }
    }

    let { data }: Props = $props();

    const STEPS = [
        ['players', 'Players'],
        ['tokens', 'Characters'],
        ['extras', 'Extras'],
        ['bluffs', 'Bluffs'],
        ['summary', 'Summary']
    ] as const;

    const builder = new PresetBuilder();
    // svelte-ignore state_referenced_locally
    const initial = data.preset;
    let name = $state(initial?.name ?? '');
    let step = $state<string>('players');
    let saving = $state(false);

    if (initial) {
        builder.setScript(initial.script);
        builder.loadCharacters(initial.character_ids, initial.bluff_ids);
        const seats = builder.chosenCharacters.length;
        if (seats >= 5 && seats <= 15) {
            builder.playerCount = seats;
            step = 'summary';
        } else {
            builder.reset();
        }
    }

    function goBackToStep(target: string) {
        if (target === step) return;
        if (target === 'extras') return;
        if (target !== 'players' && builder.playerCount === null) return;
        step = target;
    }

    async function save() {
        if (!initial) return;
        saving = true;
        try {
            const response = await fetch(`/api/presets/${initial.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim() || null,
                    character_ids: builder.allCharacterIds,
                    bluff_ids: builder.bluffIds
                })
            });
            if (!response.ok) throw new Error(`${response.status}`);
            goto(`/settings/scripts/${initial.script.id}`);
        } catch (er) {
            alert(`Failed to save preset: ${er}`);
        } finally {
            saving = false;
        }
    }
</script>

<style>
    .editor-main {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding: 1em;
        gap: 1em;
        overflow: hidden;
    }

    .editor-header {
        display: flex;
        align-items: center;
        gap: 1em;
    }

    .editor-steps {
        display: flex;
        gap: 0.5em;
        align-items: center;
        opacity: 0.7;
        font-size: 0.9em;
    }

    .editor-steps .active {
        opacity: 1;
        font-weight: bold;
    }

    .editor-steps button {
        background: none;
        border: none;
        color: inherit;
        font: inherit;
        padding: 0;
        cursor: pointer;
    }

    .editor-body {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 1em;
    }

    .section {
        background: var(--theme-bg-secondary);
        padding: 1em;
        border-radius: 1em;
        box-sizing: border-box;
    }

    .section.plain {
        background: none;
        padding: 0;
    }

    .footer-actions {
        display: flex;
        justify-content: space-between;
        gap: 1em;
    }
</style>

{#if !initial}
    <h1>Preset not found</h1>
    {#if data.error}
        <p>{data.error}</p>
    {/if}
{:else}
<div class="editor-main">
    <div class="editor-header">
        <a href="/settings/scripts/{initial.script.id}" class="button-style">← Back</a>
        <h1 style="margin: 0; font-size: 1.2em;">Edit preset</h1>
        <span style="opacity: 0.6;">{initial.script.name}</span>
        <div class="editor-steps">
            {#each STEPS as [key, label], i}
                {#if i > 0}<span>›</span>{/if}
                <button class:active={step === key} onclick={() => goBackToStep(key)}>{i + 1}. {label}</button>
            {/each}
        </div>
    </div>

    <div class="editor-body">
        {#if step === 'summary'}
            <div class="section">
                <h2 style="margin-top: 0;">Summary</h2>
                <input type="text" bind:value={name} placeholder="Preset name (optional)" style="font-size: 1.2em;" class="input-style"/>
                <p style="opacity: 0.7;">
                    {builder.seatCharacterIds.length} player{builder.seatCharacterIds.length === 1 ? '' : 's'},
                    {builder.bluffIds.length} bluff{builder.bluffIds.length === 1 ? '' : 's'}
                </p>
                <PresetStats preset={initial} />
            </div>
            <div class="section plain">
                <h2 style="margin-top: 0;">Characters</h2>
                <CharacterList characters={builder.allCharacterIds.map(id => builder.charById.get(id)).filter(c => !!c)} />
            </div>
            <div class="section plain">
                <h2 style="margin-top: 0;">Bluffs</h2>
                {#if builder.bluffIds.length === 0}
                    <div style="opacity: 0.6;">No bluffs chosen.</div>
                {:else}
                    <CharacterList characters={builder.bluffIds.map(id => builder.charById.get(id)).filter(c => !!c)} />
                {/if}
            </div>
            <div class="footer-actions">
                <button class="button-style" onclick={() => step = 'bluffs'}>← Back</button>
                <button class="button-style highlight" disabled={saving || builder.playerCount === null} onclick={save}>Save</button>
            </div>
        {:else}
            <BuilderSteps
                {builder}
                {step}
                navigate={(s) => step = s}
            />
        {/if}
    </div>
</div>
{/if}
