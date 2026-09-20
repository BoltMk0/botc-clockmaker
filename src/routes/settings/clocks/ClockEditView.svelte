<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import HSlider from '$lib/audio/client/components/HSlider.svelte';
    import type { ClocktowerAudioTrackModel } from '$lib/audio/common/model/clocktowerAudioTrackModel.svelte';
    import { dbToLinear, linearToDb } from '$lib/common/util';
    import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel';

    interface ConfigPageData {
        clock: ClocktowerModel;
        sfx_resources: {id: string, name: string}[];
    };

    let data: ConfigPageData = $props();

    let clock = $state(data.clock);
    let sfx_resources = $state(data.sfx_resources);

    $effect.pre(()=>{if(clock.config.teamName === null) clock.config.teamName = clock.clock.clockId!});

    let newFinalBellRingSoundFile: File | null = null;
    let newReminderBellSoundFile: File | null = null;

    async function saveBellSound(file: File | null, resourceName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if(file){
                const formData = new FormData();
                formData.append('file', file);

                fetch(`/resources/${resourceName}`, {
                    method: 'POST',
                    body: formData
                }).then(response => {
                    if (!response.ok) {
                        throw new Error('Failed to upload ' + resourceName);
                    }
                    console.log(resourceName + " uploaded successfully");
                    resolve();
                }).catch(error => {
                    console.error("Error uploading " + resourceName + ":", error);
                    alert("Error uploading " + resourceName + ": " + error);
                    reject(error);
                });
            } else {
                resolve();
            }
        });
    }

    async function onSave(){
        if(newFinalBellRingSoundFile){
            await saveBellSound(newFinalBellRingSoundFile, `final-bell/${clock.clock.clockId}`);
        }

        if(newReminderBellSoundFile){
            await saveBellSound(newReminderBellSoundFile, `reminder-bell/${clock.clock.clockId}`);
        }
        
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
            saveAudioSettings(clock.audio);
        }).then(()=>{
            alert("Config saved successfully!")
        }).catch(error => {
            console.error("Error saving config:", error);
            alert("Error saving config: " + error);
        });
    }

    async function saveAudioSettings(settings: ClocktowerAudioTrackModel){
        return fetch(`/api/clock/${clock.clock.clockId}/audioParams`, {
            method: 'POST',
            body: JSON.stringify(settings),
            headers: {'Content-Type': 'application/json'}
        }).then(response=>{
            if(!response.ok){
                throw new Error("Failed to save audio settings");
            }
            invalidateAll();
        });
    }

    async function onDelete(){
        if(confirm("Are you sure? This cannot be reverted"))
            await fetch(`/api/clock/${clock.clock.clockId}`, {method: 'DELETE'}).then(()=>invalidateAll())
    }

    function resetResource(name: string){
        if(confirm("Are you sure you want to reset to the default " + name + "?")){
            fetch(`/resources/${name}`, {
                method: 'DELETE'
            }).then(response => {
                if (!response.ok) {
                    throw new Error('Failed to reset bell ring sound');
                }
                alert("Bell ring sound reset to default successfully");
                newFinalBellRingSoundFile = null;
                const thisPage = window.location.pathname;
                goto(`/admin/${clock.clock.clockId}`).then(() => {
                    goto(thisPage);
                });
            }).catch(error => {
                console.error("Error resetting bell ring sound:", error);
                alert("Error resetting bell ring sound: " + error);
            });
        }
    }

    const finalBellGain = $derived(clock.audio.gain * (clock.audio.balance > 0 ? 1 : Math.cos(Math.PI/2 * Math.abs(clock.audio.balance))))
    const reminderBellGain = $derived(clock.audio.gain * (clock.audio.balance < 0 ? 1 : Math.cos(Math.PI/2 * Math.abs(clock.audio.balance))))
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
            <h2>Sound Effects</h2>
            <a href="/settings/resources" class="button-style">Manage Resources</a>
        </div>
        <table>
            <thead>
                <tr>
                    <th style="width: fit-content;">Event</th>
                    <th>Sound File</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="width: fit-content;">
                        <div>Final Bell Sound</div>
                        <div>({linearToDb(finalBellGain).toFixed(1)}dB)</div>
                    </td>
                    <td>
                        <div class="audio-file-input-container">
                            <select bind:value={clock.config.resourceMapping.finalBell.resource_id}>
                                <option value={null}>None</option>
                                {#each sfx_resources as res}
                                    <option value={`${res.id}`}>{res.name}</option>
                                {/each}
                            </select>
                            {#if clock.config.resourceMapping.finalBell.resource_id}
                                <audio src="/api/resources/{clock.config.resourceMapping.finalBell.resource_id}" controls volume={finalBellGain}></audio>
                            {/if}
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="width: fit-content;">
                        <div>Reminder Bell Sound</div>
                        <div>({linearToDb(reminderBellGain).toFixed(1)}dB)</div>
                    </td>
                    <td style="min-width: 200px;">
                        <div class="audio-file-input-container">
                        <select bind:value={clock.config.resourceMapping.reminderBell.resource_id}>
                            <option value={null}>None</option>
                            {#each sfx_resources as res}
                                <option value={`${res.id}`}>{res.name}</option>
                            {/each}
                        </select>
                        {#if clock.config.resourceMapping.reminderBell.resource_id}
                            <audio src="/api/resources/{clock.config.resourceMapping.reminderBell.resource_id}" controls volume={reminderBellGain}></audio>
                        {/if}
                        </div>
                    </td>
                </tr>
                <tr>
                    <td>Balance ({clock.audio.balance})</td>
                    <td><HSlider bind:value={clock.audio.balance} min={-1} max={1} step={0.1}/></td>
                </tr>
                
                <tr>
                    <td>Gain ({linearToDb(clock.audio.gain).toFixed(0)}dB)</td>
                    <td><HSlider value={linearToDb(clock.audio.gain)} min={-18} max={0} step={1} onchange={(val)=>clock.audio.gain = dbToLinear(val)}/></td>
                </tr>

                
                <tr>
                    <td>Pan ({clock.audio.pan})</td>
                    <td><HSlider bind:value={clock.audio.pan} min={-1} max={1} step={0.1}/></td>
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

    th {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--theme-on-bg-secondary);
        text-align: left;
        padding: 0 0.5rem 0.5rem;
    }

    td {
        padding: 0.6rem 0.5rem;
        text-align: left;
        border-top: 1px solid var(--theme-bg-tertiary);
    }

    td > div:nth-child(2) {
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

    .audio-file-input-container {
        width: 100%;
    }

    .audio-file-input-container > * {
        width: 100%;
    }

    .audio-file-input-container > audio {
        margin-top: 0.5rem;
        height: 2.25rem;
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
