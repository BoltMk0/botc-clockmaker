<script lang="ts">
    import { ClockClientModel } from '$lib/model/client/ClockClientModel.js';
    import { onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { ClocktowerAudioEngine } from '$lib/audio/client/model/AudioEngine.svelte.js';
    import AudioMixer from '$lib/audio/client/components/AudioMixer.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { PageData } from './$types';
    import MuteButton from '$lib/components/MuteButton.svelte';

    let { data }: { data: PageData } = $props();

    let clients: ClockClientModel[] = data.instances.map(({id, config, audioParams}) => new ClockClientModel(id, config, audioParams));
        

    let audioEngine: ClocktowerAudioEngine|undefined = $state(undefined);
    let teardown: ()=>void;

    onMount(()=>{
        if(!browser) return;
        ({audioEngine, teardown} = ClocktowerAudioEngine.createNewEngineForClockClients(clients, data.ambienceResources, {enableParamsTx: true}));

        clients.forEach(c=>c.init());

        return ()=>{
            teardown();
        }
    });

    onDestroy(() => {
        clients.forEach(client => client.close());
    });

</script>


<Navbar/>
{#if audioEngine}
<AudioMixer {clients} ambienceResources={data.ambienceResources} audioEngine={audioEngine}/>
<MuteButton {audioEngine}/>
{/if}