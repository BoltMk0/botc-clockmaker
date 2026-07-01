<script lang="ts">
    import { goto, invalidateAll, refreshAll } from '$app/navigation';
    import { page } from '$app/state';
    import type { Config } from '$lib/common/config.js';
    import HSlider from '$lib/components/AudioMixerComponents/HSlider.svelte';
    import Navbar from '$lib/components/Navbar.svelte';

    interface ConfigPageData {
        config: Config;
        sfx_resources: {id: string, name: string}[];
    };

    let {data}: {data: ConfigPageData} = $props();

    const id = page.params.clockid;
    
    // svelte-ignore state_referenced_locally
    const config = $state(data.config);

    $effect.pre(()=>{if(config.teamName === null) config.teamName = page.params.clockid!});

    let newFinalBellRingSoundFile: File | null = null;
    let newReminderBellSoundFile: File | null = null;

    const sfx_resources = $derived(data.sfx_resources);

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
        for(let option of config.timerOptions){
            if(option.label === ''){
                option.label = null;
            }
        }

        if(newFinalBellRingSoundFile){
            await saveBellSound(newFinalBellRingSoundFile, `final-bell/${id}`);
        }

        if(newReminderBellSoundFile){
            await saveBellSound(newReminderBellSoundFile, `reminder-bell/${id}`);
        }
        
        fetch(`/api/clock/${id}/config`, {
            method: 'POST',
            body: JSON.stringify(config),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to save config');
            }
            console.log("Config saved successfully");
            goto(`/admin/${id}`).then(() => {
                invalidateAll();
            });
        }).catch(error => {
            console.error("Error saving config:", error);
            alert("Error saving config: " + error);
        });
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
                goto(`/admin/${id}`).then(() => {
                    goto(thisPage);
                });
            }).catch(error => {
                console.error("Error resetting bell ring sound:", error);
                alert("Error resetting bell ring sound: " + error);
            });
        }
    }
</script>

<Navbar/>
<div class="main">
    <div class="panel">
        <h2>General</h2>
        <table>
            <tbody>
                <tr>
                    <td>Clock Name</td>
                    <td><input type="text" bind:value={config.teamName} placeholder="Optional name for the clock"/></td>
                </tr>
                <tr>
                    <td>Theme</td>
                    <td>
                        <div style="background-color: hsl({config.theme.hue}, 80%, 60%); padding: 5px 20px; box-sizing: border-box; border-radius: 5px; color: black; font-weight: bold;">
                            Color
                            <HSlider bind:value={config.theme.hue} min={0} max={360}/>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="panel">
        
        <div style="display: grid; grid-template-columns: 1fr auto; align-items: center;">
            <h2>Sound Effects</h2>
            <a href="/admin/resources" class="button-style">Manage Resources</a>
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
                            <select bind:value={config.resourceMapping.finalBell.resource_id}>
                                <option value={null}>None</option>
                                {#each sfx_resources as res}
                                    <option value={`${res.id}`}>{res.name}</option>
                                {/each}
                            </select>
                            {#if config.resourceMapping.finalBell.resource_id}
                                <audio src="/api/resources/{config.resourceMapping.finalBell.resource_id}" controls bind:volume={config.resourceMapping.finalBell.gain}></audio>
                            {/if}
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="width: fit-content;">Reminder Bell Sound</td>
                    <td>
                        <div class="audio-file-input-container">
                        <select bind:value={config.resourceMapping.reminderBell.resource_id}>
                            <option value={null}>None</option>
                            {#each sfx_resources as res}
                                <option value={`${res.id}`}>{res.name}</option>
                            {/each}
                        </select>
                        {#if config.resourceMapping.reminderBell.resource_id}
                            <audio src="/api/resources/{config.resourceMapping.reminderBell.resource_id}" controls bind:volume={config.resourceMapping.reminderBell.gain}></audio>
                        {/if}
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="panel">
        <h3>Timer Options</h3>
        <table>
            <thead>
                <tr>
                    <th>Label</th>
                    <th>Duration</th>
                    <th>Ring Bell When Remaining</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#each config.timerOptions as option, index}
                    <tr>
                        <td><input bind:value={option.label} type="text" /></td>
                        <td><input bind:value={option.duration} type="number" required/></td>
                        <td><input bind:value={option.ringBellWhenRemaining} type="number" /></td>
                        <td>
                            <button onclick={()=>{config.timerOptions.splice(index, 1);}}>Delete</button>
                        </td>
                    </tr>
                {/each}
                <tr>
                    <td colspan="4">
                        <button style="width: 100%;" onclick={()=>{
                            config.timerOptions.push({duration: 0, ringBellWhenRemaining: null, label: null});
                        }}>Add Timer Option</button>
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
    <div class="panel" style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 5px;">
        <a class="button-style" href="/admin/{page.params.clockid}">Back</a>
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
        height: 100%;
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

