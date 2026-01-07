<script lang="ts">
    import { ClientModel } from "$lib/client/model";
    import ClockSetter from "$lib/common/ClockSetter.svelte";
    import DaySetter from "$lib/common/DaySetter.svelte";
    import FullDisplay from "$lib/common/FullDisplay.svelte";
    import { onMount } from "svelte";

    let clockData = {
        cur: 0,
        max: 300
    };

    let audio: HTMLAudioElement;
    let model: ClientModel = new ClientModel();

    onMount(()=>{
        model.init(audio);
    });


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
<audio bind:this={audio} preload="auto" src="/bell.mp3"></audio>
{#if model}
<div style="width: fit-content; margin: auto;">
    <FullDisplay model={model} size={300} />
    <div style="max-width: 400px;">
        <DaySetter day_info={model.day_info} />
        <ClockSetter/>
    </div>
</div>

{/if}
