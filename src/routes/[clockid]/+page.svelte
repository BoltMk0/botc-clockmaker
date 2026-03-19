<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { ClockClientModel } from '$lib/client/model';
    import FullDisplay from '$lib/common/FullDisplay/FullDisplay.svelte';
    import { page } from '$app/state';
    import Navbar from '$lib/common/Navbar.svelte';
    import type { FullDisplayMode } from '$lib/common/FullDisplay/fullDisplayTypes.js';

    export let data;

    let enterButtonClicked: boolean =  true;
    let audio: HTMLAudioElement;
    let audio2: HTMLAudioElement;
    let model: ClockClientModel = new ClockClientModel(page.params.clockid, data.config);

    let displaySize = 700;
    let displayMode: FullDisplayMode = "original";

    onMount(()=>{
        model.init({finalBellAudioPlayer: audio, reminderBellAudioPlayer: audio2});

        if(localStorage.getItem("displaySize")){
            console.log("Found saved display size:", localStorage.getItem("displaySize"));
            displaySize = parseFloat(localStorage.getItem("displaySize")!);
        }
    });

    function onEnterButtonClicked() {
        console.log("Enter button clicked");
    }

    onMount(() => {
        if(localStorage.getItem("displayMode")){
            displayMode = localStorage.getItem("displayMode") as FullDisplayMode;
        }
        if(localStorage.getItem("displaySize")){
            displaySize = parseFloat(localStorage.getItem("displaySize")!);
        }
    });

    onDestroy(()=>{
        // model.close();
    });

</script>

<audio bind:this={audio} preload="auto"></audio>
<audio bind:this={audio2} preload="auto"></audio>


{#if enterButtonClicked}
<FullDisplay model={model}/>
{:else}
    <button on:click={() => { enterButtonClicked = true; onEnterButtonClicked(); }}>
        Enter
    </button>
{/if}
<Navbar clients={data.clientIds} />


