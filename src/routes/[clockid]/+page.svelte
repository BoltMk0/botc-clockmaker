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
        model.init();
    });

    function onEnterButtonClicked() {
        console.log("Enter button clicked");
    }

    onMount(() => {

    });

    onDestroy(()=>{
        model.close();
    });

</script>
{#if enterButtonClicked}
<FullDisplay model={model} size={displaySize} type={displayMode}/>
{:else}
    <button on:click={() => { enterButtonClicked = true; onEnterButtonClicked(); }}>
        Enter
    </button>
{/if}
<Navbar clients={data.clientIds} bind:size={displaySize} bind:displayMode={displayMode}/>


