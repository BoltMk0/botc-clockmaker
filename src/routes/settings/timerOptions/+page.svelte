<script lang="ts">
    import type { TimerOption } from "$lib/common/timerOption";
    import { onMount } from "svelte";

    let options: TimerOption[] = $state([]);


    onMount(()=>{
        fetch('/api/timerOptions').then(r=>{
            if(r.ok){
                return r.json();
            } else {
                throw new Error('Failed to fetch');
            }
        }).then(data=>{
            options = data;
        }).catch(er=>{
            alert('Failed to fetch timer options!');
        });
    });

    function save(){
        fetch('/api/timerOptions', {
            method: 'POST',
            body: JSON.stringify(options),
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(res=>{
            if(res.ok){
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
            <td colspan="4">
                <div style="display: flex;">
                <button style="flex: 1;" onclick={()=>options.splice(options.length-1, 1)}>Delete Option</button>
                <button style="flex: 1;" onclick={()=>options.push({duration: 600, label: '', ringBellWhenRemaining: null})}>Add Option</button>
                <button style="background-color: greenyellow;" onclick={save}>Save</button>
                </div>
            </td>
        </tr>
        <tr>
            <th rowspan="2">Label</th>
            <th colspan="2">Duration</th>
            <th rowspan="2">Reminder At</th>
        </tr>
        <tr>
            <th>Minutes</th>
            <th>Seconds</th>
        </tr>
        {#each options as option}
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
            </tr>
        {/each}
    </tbody>
</table>
</div>

<style>
    input.time-input {
        width: 5em;
    }

    .main {
        margin-top: 5em;
    }

    table {
        background-color: var(--theme-bg);
    }
</style>