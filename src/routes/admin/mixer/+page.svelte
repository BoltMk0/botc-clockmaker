<script lang="ts">
    import { ClockClientModel } from '$lib/client/model.js';
    import { onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { ClocktowerAudioEngine } from '$lib/client/audio/AudioEngine.js';
    import AudioMixer from '$lib/components/AudioMixerComponents/AudioMixer.svelte';
    import Navbar from '$lib/components/Navbar.svelte';

    export let data;

    export let audioEngine: ClocktowerAudioEngine;
    export let audioContext: AudioContext;

    let clients: ClockClientModel[] = data.instances.map(({id, config, audioParams}) => new ClockClientModel(id, config, audioParams));
        
    onMount(() => {
        if(browser){
            clients.forEach(client => client.init(undefined));
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioEngine = new ClocktowerAudioEngine(audioContext, {enableParamsTx: true});
            clients.forEach(client => {
                audioEngine.getClockTrackFor(client);
            });
        }
    });

    onDestroy(() => {
        if(audioEngine) audioEngine.close();
        clients.forEach(client => client.close());
    });

</script>

<AudioMixer {audioEngine}/>

<Navbar/>