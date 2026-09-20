<script lang="ts">
    import { goto } from "$app/navigation";
    import type { PresetFull } from "$lib/resources/common/gameData.js";
    import PresetStats from "$lib/components/setup/PresetStats.svelte";
    import BuilderSteps from "$lib/components/setup/BuilderSteps.svelte";
    import CharacterCounts from "$lib/components/setup/CharacterCounts.svelte";
    import CharacterList from "$lib/components/CharacterList.svelte";
    import TokenSorter from "$lib/components/setup/TokenSorter.svelte";
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
        ['bluffs', 'Bluffs'],
        ['summary', 'Summary']
    ] as const;

    const builder = new PresetBuilder();
    // svelte-ignore state_referenced_locally
    const initial = data.preset;
    let name = $state(initial?.name ?? '');
    let step = $state<string>('players');
    let saving = $state(false);
    let body = $state<HTMLElement>();

    $effect(() => {
        step;
        body?.scrollTo({ top: 0 });
    });

    if (initial) {
        builder.setScript(initial.script);
        builder.loadCharacters(initial.character_ids, initial.bluff_ids, initial.grim_character_ids);
        const seats = builder.bagCharacterIds.length;
        if (seats >= 4 && seats <= 15) {
            builder.playerCount = seats;
            step = 'summary';
        } else {
            builder.reset();
        }
    }

    function goBackToStep(target: string) {
        if (target === step) return;
        if (target !== 'players' && builder.playerCount === null) return;
        step = target;
    }

    async function save() {
        if (!initial) return;
        saving = true;
        try {
            const isNew = initial.id === 'new';
            const response = await fetch(isNew ? '/api/presets' : `/api/presets/${initial.id}`, {
                method: isNew ? 'POST' : 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...(isNew ? { script_id: initial.script.id } : {}),
                    name: name.trim() || null,
                    character_ids: builder.chosenCharacterIds,
                    grim_character_ids: builder.grimCharacterIds,
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

    .editor-counts {
        flex-shrink: 0;
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

    {#if step === 'tokens'}
        <div class="editor-counts">
            <CharacterCounts {builder} />
        </div>
    {/if}

    <div class="editor-body" bind:this={body}>
        {#if step === 'summary'}
            <div class="section">
                <h2 style="margin-top: 0;">Summary</h2>
                <input type="text" bind:value={name} placeholder="Preset name (optional)" style="font-size: 1.2em;" class="input-style"/>
                <p style="opacity: 0.7;">
                    {builder.playerCount} player{builder.playerCount === 1 ? '' : 's'},
                    {builder.bluffIds.length} bluff{builder.bluffIds.length === 1 ? '' : 's'}
                </p>
                <PresetStats preset={initial} />
            </div>
            {#if builder.surplusCount > 0}
                <div class="section">
                    <TokenSorter {builder} />
                </div>
            {:else}
                <div class="section plain">
                    <h2 style="margin-top: 0;">Characters</h2>
                    <CharacterList characters={builder.chosenCharacters} />
                </div>
            {/if}
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
                <button class="button-style highlight" disabled={saving || builder.playerCount === null || !builder.isSorted} onclick={save}>Save</button>
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
