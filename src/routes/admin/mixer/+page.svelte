<script lang="ts">
    import { ClockClientModel } from '$lib/model/client/ClockClientModel.js';
    import { onDestroy, onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { ClocktowerAudioEngine } from '$lib/audio/client/model/AudioEngine.svelte.js';
    import AudioMixer from '$lib/audio/client/components/AudioMixer.svelte';
    import Navbar from '$lib/components/Navbar.svelte';

    export let data;

    let audioEngine: ClocktowerAudioEngine;
    let audioContext: AudioContext;

    let clients: ClockClientModel[] = data.instances.map(({id, config, audioParams}) => new ClockClientModel(id, config, audioParams));
        
    onMount(() => {
        if(browser){
            clients.forEach(client => client.init(undefined));
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioEngine = new ClocktowerAudioEngine(audioContext, {enableParamsTx: true});
            clients.forEach(client => {
                audioEngine.getClockTrackModelFor(client);
            });

            const resumeAudioContext = () => {
                audioContext.resume();
            };
            window.addEventListener('pointerdown', resumeAudioContext);
            onDestroy(() => window.removeEventListener('pointerdown', resumeAudioContext));
        }
    });

    onDestroy(() => {
        if(audioEngine) audioEngine.close();
        clients.forEach(client => client.close());
    });

</script>

<AudioMixer {audioEngine}/>

<Navbar/>