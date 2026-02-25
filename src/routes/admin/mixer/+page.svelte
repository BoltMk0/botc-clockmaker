<script lang="ts">
    import { ClientModel } from '$lib/client/model.js';
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import ChannelStrip from './ChannelStrip.svelte';
    import AmbienceChannelStrip from './AmbienceChannelStrip.svelte';
    import VLoudnessMeter from './VLoudnessMeter.svelte';

    export let data;

    let audioContext: AudioContext;
    let masterGain: GainNode;
    let masterAnalyser: AnalyserNode;
    let masterSplitter: ChannelSplitterNode;
    let masterAnalyserL: AnalyserNode;
    let masterAnalyserR: AnalyserNode;
    let masterTapGainL: GainNode;
    let masterTapGainR: GainNode;

    $: clients = data.instances.map(({id, config}) => new ClientModel(id, config));

    onMount(() => {
        if(browser){
            audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Master bus: everything feeds into this, then to destination.
            masterGain = audioContext.createGain();
            masterAnalyser = audioContext.createAnalyser();
            masterGain.connect(masterAnalyser).connect(audioContext.destination);

            // L/R analysis tap. You can't analyse after destination, so we split
            // the stereo signal before the destination and feed two analysers.
            // The tap is silent (gain=0) to avoid doubling audio output.
            masterSplitter = audioContext.createChannelSplitter(2);
            masterAnalyserL = audioContext.createAnalyser();
            masterAnalyserR = audioContext.createAnalyser();
            masterTapGainL = audioContext.createGain();
            masterTapGainR = audioContext.createGain();
            masterTapGainL.gain.value = 0;
            masterTapGainR.gain.value = 0;

            masterGain.connect(masterSplitter);
            masterSplitter.connect(masterAnalyserL, 0);
            masterSplitter.connect(masterAnalyserR, 1);
            masterAnalyserL.connect(masterTapGainL).connect(audioContext.destination);
            masterAnalyserR.connect(masterTapGainR).connect(audioContext.destination);
        }
    });

</script>

<div style="display: flex; gap: 5px;">

{#if audioContext && masterGain && masterAnalyser && masterAnalyserL && masterAnalyserR}
    {#each clients as client, index (client.clockId)}
        <div style="">
            <ChannelStrip audioContext={audioContext} clientModel={client} outputNode={masterGain} />
        </div>
    {/each}
    <AmbienceChannelStrip context={audioContext} resources={data.ambienceResources} outputNode={masterGain} />

    <div style="display: grid; grid-template-rows: auto 1fr; align-items: start;">
        <div style="text-align: center; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #bbb;">Master</div>
        <div style="height: 250px; padding: 6px 10px; display: grid; grid-template-columns: auto auto; gap: 10px;">
            <div style="display: grid; grid-template-rows: auto 1fr;">
                <div style="text-align: center; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #bbb;">L</div>
                <VLoudnessMeter analyserNode={masterAnalyserL} minDb={-60} />
            </div>
            <div style="display: grid; grid-template-rows: auto 1fr;">
                <div style="text-align: center; font-family: 'Courier New', Courier, monospace; font-weight: bold; color: #bbb;">R</div>
                <VLoudnessMeter analyserNode={masterAnalyserR} minDb={-60} />
            </div>
        </div>
    </div>
{/if}

</div>