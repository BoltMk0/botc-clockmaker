<script lang="ts">
    import { ClockClientModel } from '$lib/model/client/ClockClientModel.js';
    import { onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { ClocktowerAudioEngine } from '$lib/audio/client/model/AudioEngine.svelte.js';
    import AudioMixer from '$lib/audio/client/components/AudioMixer.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let clients: ClockClientModel[] = data.instances.map(({id, config, audioParams}) => new ClockClientModel(id, config, audioParams));
        
    onMount(() => {
        clients.forEach(c=>c.init());
    });

    onDestroy(() => {
        clients.forEach(client => client.close());
    });

</script>

<AudioMixer {clients} ambienceResources={data.ambienceResources}/>

<Navbar/>