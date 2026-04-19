<script lang="ts">
    import { ClockClientModel } from "$lib/client/model";
    import ClockSetter from "./ClockSetter.svelte";
    import FullDisplay from "$lib/components/FullDisplay/FullDisplay.svelte";
    import { commsStatusToColor } from "$lib/common/util";
    import { onDestroy, onMount } from "svelte";
    import { get, type Unsubscriber } from "svelte/store";
    import { page } from "$app/state";
    import Navbar from "$lib/components/Navbar.svelte";

    export let data;

    let clockData = {
        cur: 0,
        max: 300
    };

    const id = page.params.clockid

    let audio: HTMLAudioElement;
    let audio2: HTMLAudioElement;
    let model: ClockClientModel = new ClockClientModel(id, data.config);

    let commsStateUnsubscriber: Unsubscriber | undefined = undefined;
    let buttonColor: string = "red";

    $: day_info = model.day_info;

    onMount(()=>{
        console.log("Admin page for clock", id, "is mounting, initializing model and subscribing to comms state");
        model.init({finalBellAudioPlayer: audio, reminderBellAudioPlayer: audio2});
        commsStateUnsubscriber = model.sse_connection_manager?.comms_state.subscribe(value => {
            buttonColor = commsStatusToColor(value);
        });
    });

    onDestroy(()=>{
        console.log("Admin page for clock", id, "is being destroyed, closing model and unsubscribing from comms state");
        commsStateUnsubscriber?.();
        model.close();
    });

    function bump_day(delta: number) {
        let day = get(day_info).day + delta;
        let max = get(day_info).max;

        if(day > max){
            max = day;
        }

        day = Math.max(0, day);

        fetch(`/admin/api/clock/${id}/day`, {
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

    function startClock(params: {duration: number, ringBellAfter?: number}) {
        // send request to start clock
        
        fetch(`/admin/api/clock/${id}/start`, {
            method: 'POST',
            body: JSON.stringify({
                duration: params.duration,
                ringBellAfter: params.ringBellAfter
            }),
            headers: {'Content-Type': 'application/json'}
        }).then(response => {
            if (!response.ok) {
                throw new Error('Failed to start clock');
            }
            console.log("Clock started");
        }).catch(error => {
            console.error("Error starting clock:", error);
        });
    }

</script>
<audio bind:this={audio} preload="auto"></audio>
<audio bind:this={audio2} preload="auto"></audio>
<Navbar/>
{#if model}
<div style="width: min-content; display: grid; grid-template-rows: auto auto; gap: 20px;">
    <div style="height: 300px;">
    <FullDisplay {model} size={240}/>
    </div>
    <div style="">
        <ClockSetter {model}/>
    </div>
</div>
{/if}
