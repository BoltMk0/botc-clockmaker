<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { ClientModel } from '$lib/client/model';
    import FullDisplay from '$lib/common/FullDisplay.svelte';

    let enterButtonClicked: boolean =  true;
    let audio: HTMLAudioElement;
    let audio2: HTMLAudioElement;
    let model: ClientModel = new ClientModel();

    onMount(()=>{
        model.init({finalBellAudioPlayer: audio, reminderBellAudioPlayer: audio2});
    });

    let clockData = {
        cur: 0,
        max: 300
    }

    function onEnterButtonClicked() {
        console.log("Enter button clicked");
    }

    onMount(() => {
        
    });

    onDestroy(()=>{
        // model.close();
    });

</script>

<audio bind:this={audio} preload="auto"></audio>
<audio bind:this={audio2} preload="auto"></audio>

{#if enterButtonClicked}
<FullDisplay model={model} />
{:else}
    <button on:click={() => { enterButtonClicked = true; onEnterButtonClicked(); }}>
        Enter
    </button>
{/if}


