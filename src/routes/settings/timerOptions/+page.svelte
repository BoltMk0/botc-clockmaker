<script lang="ts">
    import type { TimerOption } from "$lib/common/timerOption";
    import { onMount } from "svelte";

    let options: TimerOption[] = $state([]);
    let savedSnapshot = $state(JSON.stringify([]));
    let dirty = $derived(JSON.stringify(options) !== savedSnapshot);


    onMount(()=>{
        fetch('/api/timerOptions').then(r=>{
            if(r.ok){
                return r.json();
            } else {
                throw new Error('Failed to fetch');
            }
        }).then(data=>{
            options = data;
            savedSnapshot = JSON.stringify(data);
        }).catch(er=>{
            alert('Failed to fetch timer options!');
        });
    });

    function save(){
        const snapshot = JSON.stringify(options);
        fetch('/api/timerOptions', {
            method: 'POST',
            body: JSON.stringify(options),
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(res=>{
            if(res.ok){
                savedSnapshot = snapshot;
                alert('Saved!');
            } else {
                res.json().then(t=>{
                    alert(`Failed to save (${res.status})\n${t.message}\n${JSON.stringify(options)}`);
                }).catch(e => {
                    alert("Failed to save")
                })
            }
        })
    }
</script>

<div class="center-content main">
<table>
    <tbody>
        <tr>
            <th rowspan="2">Label</th>
            <th colspan="2">Duration</th>
            <th rowspan="2">Reminder At</th>
            <th rowspan="2"></th>
        </tr>
        <tr>
            <th>Minutes</th>
            <th>Seconds</th>
        </tr>
        {#each options as option, i}
            <tr>
                <td><input bind:value={option.label} type="text" placeholder="Label"/></td>
                <td><input class="time-input" value={Math.floor(option.duration / 60)} type="number" onchange={(ev)=>{let secs = option.duration % 60; option.duration = Number((ev.target! as HTMLInputElement).value) * 60 + secs;}}/></td>
                <td><input class="time-input" value={option.duration % 60} type="number" onchange={(ev)=>{let mins = Math.floor(option.duration / 60); option.duration = Number((ev.target! as HTMLInputElement).value) + (mins * 60);}}/></td>
                <td>
                    <input type="checkbox" checked={option.ringBellWhenRemaining !== null} onchange={ev=>option.ringBellWhenRemaining = (ev.target! as any).checked ? 60 : null}/>
                    {#if option.ringBellWhenRemaining !== null}
                    <input value={option.ringBellWhenRemaining} onchange={ev=>option.ringBellWhenRemaining = Number((ev.target! as HTMLInputElement).value)}/>
                    {/if}
                </td>
                <td><button onclick={()=>options.splice(i, 1)}>Delete</button></td>
            </tr>
        {/each}
        <tr>
            <td colspan="5">
                <div style="display: flex;">
                <button style="flex: 1;" class="add" onclick={()=>options.push({duration: 600, label: '', ringBellWhenRemaining: null})}>Add Option</button>
                </div>
            </td>
        </tr>
    </tbody>
</table>
<button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>

<style>
    input.time-input {
        width: 5em;
    }

    .main {
        flex-direction: column;
        margin-top: 5em;
    }

    table {
        background-color: var(--theme-bg);
        color: var(--theme-on-bg);
        border-collapse: collapse;
    }

    th {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        padding: 0.4em 0.6em;
    }

    td {
        padding: 0.3em 0.5em;
        border-top: 1px solid var(--theme-bg-tertiary);
    }

    tr:nth-child(even) td {
        background-color: var(--theme-bg-secondary);
    }

    input, button {
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-slider-trim);
        border-radius: 4px;
        padding: 0.3em 0.5em;
    }

    input:focus {
        outline: 2px solid var(--theme-highlight);
    }

    input[type="checkbox"] {
        accent-color: var(--theme-highlight);
    }

    button {
        background-color: var(--theme-bg-tertiary);
        color: var(--theme-on-bg-tertiary);
        cursor: pointer;
    }

    button:hover {
        border-color: var(--theme-highlight);
    }

    button.add {
        background-color: transparent;
        border: 2px dashed var(--theme-slider-trim);
    }

    button.add:hover {
        border-color: var(--theme-highlight);
    }

    button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    button.save {
        margin: 1.5em 0;
        padding: 0.6em 1.5em;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }
</style>