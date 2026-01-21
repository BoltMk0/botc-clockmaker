<script lang="ts">
    import { ClientModel } from "$lib/client/model";
    import ClockSetter from "./ClockSetter.svelte";
    import FullDisplay from "$lib/common/FullDisplay/FullDisplay.svelte";
    import { commsStatusToColor } from "$lib/common/util";
    import { onDestroy, onMount } from "svelte";
    import { get, type Unsubscriber } from "svelte/store";

    let clockData = {
        cur: 0,
        max: 300
    };

    let audio: HTMLAudioElement;
    let audio2: HTMLAudioElement;
    let model: ClientModel = new ClientModel();

    let commsStateUnsubscriber: Unsubscriber | undefined = undefined;
    let buttonColor: string = "red";

    $: day_info = model.day_info;

    onMount(()=>{
        model.init({finalBellAudioPlayer: audio, reminderBellAudioPlayer: audio2});
        commsStateUnsubscriber = model.sse_connection_manager?.comms_state.subscribe(value => {
            buttonColor = commsStatusToColor(value);
        });
    });

    onDestroy(()=>{
        commsStateUnsubscriber?.();
    });

    function bump_day(delta: number) {
        let day = get(day_info).day + delta;
        let max = get(day_info).max;

        if(day > max){
            max = day;
        }

        day = Math.max(0, day);

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

    function startClock(params: {duration: number, ringBellAfter?: number}) {
        // send request to start clock
        
        fetch('/admin/api/clock/start', {
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

{#if model}
<div style="width: min-content; margin: auto;">
    <FullDisplay {model} size={300} buttonColor={buttonColor} onDayShift={(delta)=>{bump_day(delta)}}/>
    <div style="max-width: 400px;">
        <ClockSetter {model}/>
    </div>
</div>

{/if}
