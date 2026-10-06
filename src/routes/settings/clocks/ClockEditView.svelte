<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import type { ClockSfxPreset } from '$lib/audio/common/clockSfxPreset';
    import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel';

    interface ConfigPageData {
        clock: ClocktowerModel;
        clockSfxPresets: ClockSfxPreset[];
    };

    let data: ConfigPageData = $props();

    // svelte-ignore state_referenced_locally
    let clock = $state(data.clock);

    $effect.pre(()=>{if(clock.config.teamName === null) clock.config.teamName = clock.clock.clockId!});

    async function onSave(){
        fetch(`/api/clock/${clock.clock.clockId}/config`, {
            method: 'POST',
            body: JSON.stringify(clock.config),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to save config');
            }
            console.log("Config saved successfully");
            invalidateAll();
        }).then(()=>{
            alert("Config saved successfully!")
        }).catch(error => {
            console.error("Error saving config:", error);
            alert("Error saving config: " + error);
        });
    }

    async function onDelete(){
        if(confirm("Are you sure? This cannot be reverted"))
            await fetch(`/api/clock/${clock.clock.clockId}`, {method: 'DELETE'}).then(()=>invalidateAll())
    }

    const selectedPreset = $derived(data.clockSfxPresets.find(p => p.id === clock.config.clockSfxPresetId));
</script>

<div class="main">
    <div class="panel">
        <h2>General</h2>
        <table>
            <tbody>
                <tr>
                    <td>Clock Name</td>
                    <td><input type="text" bind:value={clock.config.teamName} placeholder="Optional name for the clock"/></td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="panel">
        <div class="panel-header">
            <h2>Clock SFX Preset</h2>
            <a href="/settings/audio" class="button-style">Manage Presets</a>
        </div>
        <table>
            <tbody>
                <tr>
                    <td>Bell Sounds</td>
                    <td>
                        <select bind:value={clock.config.clockSfxPresetId}>
                            <option value={null}>None</option>
                            {#each data.clockSfxPresets as preset (preset.id)}
                                <option value={preset.id}>{preset.name}</option>
                            {/each}
                        </select>
                        {#if clock.config.clockSfxPresetId !== null && !selectedPreset}
                            <div>The selected preset no longer exists.</div>
                        {:else if selectedPreset}
                            <div>
                                Final bell: {selectedPreset.final ? 'yes' : 'none'} &middot;
                                Reminder bell: {selectedPreset.reminder ? 'yes' : 'none'} &middot;
                                <a href="/settings/audio/clocksfx/{selectedPreset.id}">Edit</a>
                            </div>
                        {/if}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="actions">
        <button class="delete" onclick={onDelete} disabled={clock.clock.clockId === 'default'}>Delete</button>
        <button class="save" onclick={onSave}>Save</button>
    </div>

</div>

<style>
    .main {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin: auto;
        padding: 1.5rem;
        box-sizing: border-box;
        width: 100%;
        max-width: 56rem;
        color: var(--theme-on-bg);
    }

    .panel {
        background-color: var(--theme-bg-secondary);
        padding: 1.25rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 4px 16px var(--theme-shadow);
    }

    h2 {
        margin: 0 0 1rem;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--theme-on-bg-secondary);
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }


    td {
        padding: 0.6rem 0.5rem;
        text-align: left;
        border-top: 1px solid var(--theme-bg-tertiary);
    }

    td > div:nth-child(2) {
        margin-top: 0.4rem;
        font-size: 0.8rem;
        color: var(--theme-on-bg-secondary);
    }

    input, select {
        width: 100%;
        box-sizing: border-box;
        padding: 0.5rem 0.6rem;
        border: 1px solid transparent;
        border-radius: 6px;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        font: inherit;
    }

    input:focus, select:focus {
        outline: none;
        border-color: var(--theme-highlight);
    }

    .panel-header {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: center;
    }

    .panel-header h2 {
        margin: 0 0 1rem;
    }

    .actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 0.75rem;
    }

    .actions button {
        padding: 0.7rem 1rem;
        border: none;
        border-radius: 8px;
        font: inherit;
        cursor: pointer;
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        transition: filter 0.15s;
    }

    .actions button:hover:not(:disabled) {
        filter: brightness(1.15);
    }

    .actions button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .actions .save {
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
    }

    .actions .delete:hover:not(:disabled) {
        background-color: var(--theme-error);
        color: var(--theme-on-error);
        filter: none;
    }
</style>
