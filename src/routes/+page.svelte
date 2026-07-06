<script lang="ts">
    import { browser } from '$app/environment';
    import { ClockClientModel } from '$lib/model/client/ClockClientModel.js';
    import { onDestroy, onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { FullDisplayMode } from '$lib/components/FullDisplay/fullDisplayTypes.js';
    import { ClocktowerAudioEngine } from '$lib/audio/client/model/AudioEngine.svelte.js';

    export let data;

    $: clients = browser ? data.instances.map(({id, config, audioParams}) => new ClockClientModel(id, config, audioParams)) : [];
    
    let teardown: ()=>void;
    
    let showNavbar: boolean = false;

    let audioUnlocked = false;

    let displaySize: number;
    
    let displayMode: FullDisplayMode;


    onMount(() => {
        if(browser){
            clients.forEach(client => client.init());
            ({ teardown} = ClocktowerAudioEngine.createNewEngineForClockClients(clients, []));
        }
    });

    onDestroy(()=>{
        if(teardown) teardown();
    })
</script>

<div class="clock-container" style="grid-template-columns: repeat({clients.length} 1fr);">
    {#each clients as model, index (model.clockId)}
        <FullDisplay model={model} models={clients} bind:size={displaySize} type={displayMode}/>
    {/each}
</div>

<Navbar bind:size={displaySize} bind:displayMode={displayMode} visible={showNavbar}></Navbar>
    
<style>
    .clock-container{
        display: flex;
        width: 100%;
        height: 100%;
        gap: 10px;
        padding: 5px;
        justify-content: space-evenly;
        box-sizing: border-box;
    }
</style>
