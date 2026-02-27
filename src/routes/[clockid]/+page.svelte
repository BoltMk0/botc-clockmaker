<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { ClientModel } from '$lib/client/model';
    import FullDisplay from '$lib/common/FullDisplay/FullDisplay.svelte';
    import { page } from '$app/state';

    export let data;

    let enterButtonClicked: boolean =  true;
    let audio: HTMLAudioElement;
    let audio2: HTMLAudioElement;
    let model: ClientModel = new ClientModel(page.params.clockid, data.config);

    let fontScale: number = 1.0;


    onMount(()=>{
        model.init({finalBellAudioPlayer: audio, reminderBellAudioPlayer: audio2});
        if(localStorage.getItem("fontScale")){
            fontScale = parseFloat(localStorage.getItem("fontScale")!);
        }
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
<FullDisplay model={model} fontScale={fontScale} />
<a class="button-style hidden-button" style="position: absolute; top: 0.5em; left: 0.5em; padding: 0.8em 1em;" href="/">
    Back
</a>
{:else}
    <button on:click={() => { enterButtonClicked = true; onEnterButtonClicked(); }}>
        Enter
    </button>
{/if}


