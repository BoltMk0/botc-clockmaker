<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { ClockClientModel } from '$lib/model/client/ClockClientModel.js';
    import FullDisplay from '$lib/components/FullDisplay/FullDisplay.svelte';
    import { page } from '$app/state';
    import Navbar from '$lib/components/Navbar.svelte';
    import { ClocktowerAudioEngine } from '$lib/audio/client/model/AudioEngine.svelte.js';
    import type { PageData } from './$types';
    import MuteButton from '$lib/components/MuteButton.svelte';

    let { data }: { data: PageData } = $props();

    let model: ClockClientModel = new ClockClientModel(page.params.clockid, data.config, data.config.audioParams);
    let audioEngine: ClocktowerAudioEngine|undefined = $state(undefined);
    let teardown: ()=>void;


    onMount(()=>{
        model.init();
    });

    function onEnterButtonClicked() {
        console.log("Enter button clicked");
    }

    onMount(() => {
        model.init();
        ({ teardown, audioEngine} = ClocktowerAudioEngine.createNewEngineForClockClients([model], data.ambienceResources));
    });

    onDestroy(()=>{
        model.close();
        if(teardown) teardown();
    });

</script>

<FullDisplay model={model} />

<Navbar/>

{#if audioEngine}
<MuteButton {audioEngine}/>
{/if}

