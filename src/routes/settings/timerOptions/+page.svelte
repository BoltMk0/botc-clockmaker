<script lang="ts">
    import type { TimerOption } from "$lib/common/timerOption";
    import { onMount } from "svelte";
    import BinIcon from "$lib/assets/binIcon.svelte";

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
<div class="panel">
<div class="panel-header">
    <h2>Timer Options</h2>
    <button class="save" disabled={!dirty} onclick={save}>Save changes</button>
</div>
<p class="description">Sets the timer options across all games.</p>
<div class="data-table-scroll">
<table class="data-table">
    <tbody>
        <tr class="header-row">
            <th rowspan="2">Label</th>
            <th colspan="2">Duration</th>
            <th rowspan="2">Reminder At</th>
            <th rowspan="2"></th>
        </tr>
        <tr class="header-row">
            <th>Minutes</th>
            <th>Seconds</th>
        </tr>
        {#each options as option, i}
            <tr class="option-row">
                <td class="label-cell"><input bind:value={option.label} type="text" placeholder="Label" aria-label="Label"/></td>
                <td data-label="Minutes"><input class="time-input" value={Math.floor(option.duration / 60)} type="number" aria-label="Minutes" onchange={(ev)=>{let secs = option.duration % 60; option.duration = Number((ev.target! as HTMLInputElement).value) * 60 + secs;}}/></td>
                <td data-label="Seconds"><input class="time-input" value={option.duration % 60} type="number" aria-label="Seconds" onchange={(ev)=>{let mins = Math.floor(option.duration / 60); option.duration = Number((ev.target! as HTMLInputElement).value) + (mins * 60);}}/></td>
                <td data-label="Reminder At">
                    <div class="reminder">
                        <input type="checkbox" aria-label="Ring reminder bell" checked={option.ringBellWhenRemaining !== null} onchange={ev=>option.ringBellWhenRemaining = (ev.target! as any).checked ? 60 : null}/>
                        {#if option.ringBellWhenRemaining !== null}
                        <input class="reminder-input" type="number" aria-label="Reminder seconds remaining" value={option.ringBellWhenRemaining} onchange={ev=>option.ringBellWhenRemaining = Number((ev.target! as HTMLInputElement).value)}/>
                        <span class="unit">s</span>
                        {/if}
                    </div>
                </td>
                <td class="delete-cell"><button class="delete" onclick={()=>options.splice(i, 1)} aria-label="Delete {option.label || 'option'}" title="Delete"><BinIcon size={18}/></button></td>
            </tr>
        {/each}
        <tr class="add-row">
            <td colspan="5">
                <div style="display: flex;">
                <button style="flex: 1;" class="add" onclick={()=>options.push({duration: 600, label: '', ringBellWhenRemaining: null})}>Add Option</button>
                </div>
            </td>
        </tr>
    </tbody>
</table>
</div>
</div>
</div>

<style>
    input.time-input {
        width: 5em;
    }

    /* Three digits, plus padding, border and the number spinner */
    input.reminder-input {
        width: calc(3ch + 2.5em + 2px);
        box-sizing: border-box;
        flex: none;
    }

    .main {
        height: 100%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.5rem;
        align-items: flex-start;
    }

    .panel {
        padding: 1.5rem;
        box-sizing: border-box;
        background-color: var(--theme-bg-secondary);
        color: var(--theme-on-bg-secondary);
        border: 1px solid var(--theme-bg-tertiary);
        border-radius: 14px;
        box-shadow: 0 6px 24px var(--theme-shadow);
    }

    .panel-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem 1.5rem;
    }

    .reminder {
        display: flex;
        align-items: center;
        gap: 0.5em;
    }

    .unit {
        opacity: 0.7;
    }

    .description {
        margin: 0.25rem 0 1.25rem;
        font-size: 0.9rem;
        font-style: italic;
        opacity: 0.8;
    }

    .panel-header h2 {
        margin: 0;
        font-size: 1.5rem;
        color: var(--theme-on-bg);
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

    button.delete {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 0.5em;
        align-self: stretch;
    }

    /* Stretch the bin button to the height of the row's text input */
    .delete-cell {
        height: 1px;
    }

    .delete-cell button.delete {
        height: 100%;
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
        padding: 0.5em 1.2em;
        background-color: var(--theme-highlight);
        color: var(--theme-on-highlight);
        border-color: var(--theme-highlight);
    }

    /* Phones: drop the header rows and show each option as a card with labelled fields */
    @media (max-width: 600px) {
        .main {
            padding: 0.75rem;
        }

        .panel {
            width: 100%;
            padding: 1rem;
        }

        .data-table-scroll {
            overflow-x: visible;
        }

        .data-table,
        .data-table tbody {
            display: block;
        }

        .header-row {
            display: none;
        }

        .option-row {
            display: grid;
            /* Label + Delete on the first row; Minutes, Seconds and the wider Reminder below */
            grid-template-columns: 1fr 1fr 1fr auto;
            gap: 0.6em;
            padding: 0.75em;
            margin-bottom: 0.75em;
            border-radius: 8px;
            background-color: var(--theme-bg);
        }

        .data-table .option-row td {
            display: flex;
            flex-direction: column;
            gap: 0.25em;
            min-width: 0;
            padding: 0;
            border: none;
            background-color: transparent;
        }

        .data-table .option-row td[data-label]::before {
            content: attr(data-label);
            font-size: 0.8rem;
            opacity: 0.7;
        }

        .label-cell {
            grid-column: 1 / 4;
        }

        .delete-cell {
            grid-column: 4;
            grid-row: 1;
            height: auto;
        }

        .delete-cell button.delete {
            flex: 1;
            height: auto;
            padding: 0 0.7em;
        }

        .data-table .option-row td[data-label="Reminder At"] {
            grid-column: 3 / -1;
        }

        .option-row input[type="text"],
        .option-row input.time-input {
            width: 100%;
            box-sizing: border-box;
            font-size: 1rem;
        }

        .option-row input.reminder-input {
            font-size: 1rem;
        }

        .reminder input[type="checkbox"] {
            width: 1.3em;
            height: 1.3em;
            flex: none;
        }

        .reminder {
            min-height: 2.2em;
        }

        .add-row,
        .add-row td {
            display: block;
            padding: 0;
            border: none;
            background-color: transparent;
        }

        button {
            padding: 0.5em 0.9em;
        }
    }
</style>