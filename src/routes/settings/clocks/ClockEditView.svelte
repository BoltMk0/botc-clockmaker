<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import HSlider from '$lib/audio/client/components/HSlider.svelte';
    import type { ClocktowerModel } from '$lib/model/common/ClocktowerModel';

    interface ConfigPageData {
        clock: ClocktowerModel;
        sfx_resources: {id: string, name: string}[];
    };

    let data: ConfigPageData = $props();

    let clock = $state(data.clock);
    let sfx_resources = $state(data.sfx_resources);
    $effect(()=>{
        clock = data.clock;
        sfx_resources = data.sfx_resources;
    });

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
                <tr>
                    <td>Theme</td>
                    <td>
                        <div style="background-color: hsl({clock.config.theme.hue}, 80%, 60%); padding: 5px 20px; box-sizing: border-box; border-radius: 5px; color: black; font-weight: bold;">
                            Color
                            <HSlider bind:value={clock.config.theme.hue} min={0} max={360}/>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="panel">
        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center;">
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
                    <td style="width: fit-content;">Final Bell Sound</td>
                    <td>
                        <div class="audio-file-input-container">
                            <select bind:value={clock.config.resourceMapping.finalBell.resource_id}>
                                <option value={null}>None</option>
                                {#each sfx_resources as res}
                                    <option value={`${res.id}`}>{res.name}</option>
                                {/each}
                            </select>
                            {#if clock.config.resourceMapping.finalBell.resource_id}
                                <audio src="/api/resources/{clock.config.resourceMapping.finalBell.resource_id}" controls bind:volume={clock.audio.gain}></audio>
                            {/if}
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="width: fit-content;">Reminder Bell Sound</td>
                    <td style="min-width: 200px;">
                        <div class="audio-file-input-container">
                        <select bind:value={clock.config.resourceMapping.reminderBell.resource_id}>
                            <option value={null}>None</option>
                            {#each sfx_resources as res}
                                <option value={`${res.id}`}>{res.name}</option>
                            {/each}
                        </select>
                        {#if clock.config.resourceMapping.reminderBell.resource_id}
                            <audio src="/api/resources/{clock.config.resourceMapping.reminderBell.resource_id}" controls bind:volume={clock.audio.gain}></audio>
                        {/if}
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>

    <div class="panel" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px;">
        <button class="button-style" onclick={onDelete} disabled={clock.clock.clockId === 'default'}>Delete</button>
        <button class="button-style" onclick={onSave}>Save</button>
    </div>

</div>

<style>


    .audio-file-input-container {
        width: 100%;
    }

    .audio-file-input-container > * {
        width: 100%;
    }


    .audio-file-input-container > audio{
        margin-top: 5px;
    }

    .panel {
        background-color: #555;
        padding: 15px 20px;
        border-radius: 10px;
        box-shadow: 0 0 10px rgba(0,0,0,0.5);
    }

    .main {
        display: grid;
        gap: 10px;
        width: fit-content;
        margin: auto;
        padding: 2em;
        box-sizing: border-box;
        width: 100%;
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    th, td {
        border: 1px solid #333;
        padding: 2px 4px;
        text-align: center;
    }

    input {
        width: 100%;
        box-sizing: border-box;
        padding: 5px;
        border: 1px solid #333;
        border-radius: 5px;
        background-color: #777;
        color: white;
    }

    table button {
        padding: 3px 8px;
        font-size: inherit;
        border-radius: 5px;
        border: none;
        background-color: #777;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
    }

</style>

