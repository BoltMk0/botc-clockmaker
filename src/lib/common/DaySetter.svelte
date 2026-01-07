<script lang="ts">
    import { get, type Readable } from "svelte/store";

    export let day_info: Readable<{day: number; max: number}>;

    function bump_day(delta: number) {
        let day = get(day_info).day + delta;
        let max = get(day_info).max;

        if(day > max){
            max = day;
        }

        fetch('/admin/api/day', {
            method: 'POST',
            body: JSON.stringify({day: day, max: max}),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to set day');
            }
            console.log("Day set to", day);
        }).catch(error => {
            console.error("Error setting day:", error);
        });
    }
</script>

<div style="margin: 20px; text-align: center; display: grid; background-color: #2222; padding: 10px; border-radius: 10px; border: 2px solid white;">
    <h3>Day Controls</h3>
    <div class='setter-row'>
        <button on:click={()=>{bump_day(-1)}}>-</button>
        <input type="number" bind:value={$day_info.day} min="0" max={$day_info.max} />
        <button on:click={()=>{bump_day(1)}}>+</button>
    </div>
</div>

<style>
    .setter-row {
        width: fit-content;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 10px;
        height: 2em;
        margin-bottom: 20px;
        font-size: small;
    }

    h3 {
        margin: 10px;
    }

    input[type="number"] {
        height: 100%;
        font-size: 1.5em;
        width: 60px;
        text-align: center;
    }

    button {
        height: 100%;
        font-size: 1.5em;
        aspect-ratio: 1/1;
    }
</style>