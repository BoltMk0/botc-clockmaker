<script lang="ts">
    import { browser } from '$app/environment';
    import { ClockClientModel } from '$lib/model/client/ClockClientModel.js';
    import { onMount } from 'svelte';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import { ClocktowerAudioEngine } from '$lib/audio/client/model/AudioEngine.svelte.js';

    let {
        data
    } = $props();

    const clients = $derived(browser ? data.instances.map(({id, config, audioParams}) => new ClockClientModel(id, config, audioParams)) : []);
    
    
    onMount(() => {
        if(browser){
            clients.forEach(client => client.init());
            let { teardown} = ClocktowerAudioEngine.createNewEngineForClockClients(clients, []);

            return teardown;
        }

    });

</script>

<div class="clock-container" style="grid-template-columns: repeat({clients.length} 1fr);">
    {#each clients as model, index (model.clockId)}
        <FullDisplay model={model} models={clients}/>
    {/each}
</div>

<Navbar/>
    
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
