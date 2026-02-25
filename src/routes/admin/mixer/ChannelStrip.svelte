<script lang="ts">
    import type { ClientModel } from '$lib/client/model.js';
    import { onDestroy, onMount } from 'svelte';
    import HSlider from './HSlider.svelte';
    import VSlider from './VSlider.svelte';
    import { browser } from '$app/environment';
    import { formatGain, formatPan } from './util.js';
    export let audioContext: AudioContext;
    export let clientModel: ClientModel;
    export let outputNode: AudioNode | null = null;

    type ChannelStripType = {
        audio1: HTMLAudioElement;
        audio2: HTMLAudioElement;
        gainNode: GainNode;
        panNode: StereoPannerNode;
        client: ClientModel;
    };

    let channelStrip: ChannelStripType;
    let audioParams = clientModel.audioParams;

    let audioParamsUnsubscribe: (() => void) | undefined = undefined;

    function callUnsubscribes(){
        if(audioParamsUnsubscribe) audioParamsUnsubscribe();
    }

    function setupAudioForClient(client: ClientModel): ChannelStripType {
        const audio1 = new Audio();
        const audio2 = new Audio();

        const gainNode = audioContext.createGain();
        const panNode = audioContext.createStereoPanner();

        const source1 = audioContext.createMediaElementSource(audio1);
        const source2 = audioContext.createMediaElementSource(audio2);

        const destination = outputNode ?? audioContext.destination;
        source1.connect(gainNode).connect(panNode).connect(destination);
        source2.connect(gainNode).connect(panNode).connect(destination);
        
        callUnsubscribes();
        audioParamsUnsubscribe = client.audioParams.subscribe(params => {
            console.log("Applying new audio params:", params);
            gainNode.gain.value = params.gain;
            panNode.pan.value = params.pan;
            if(channelStrip) channelStrip = channelStrip;
        });

        client.init({finalBellAudioPlayer: audio1, reminderBellAudioPlayer: audio2});

        return {client, audio1, audio2, gainNode, panNode};
    }

    onMount(()=>{
        if(browser){
            channelStrip = setupAudioForClient(clientModel);
        }
    });

    onDestroy(()=>{
        channelStrip.client.close();
        callUnsubscribes();
    });

    function uploadAudioParams(){
        fetch(`/admin/api/clock/${channelStrip.client.clockId}/audioParams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gain: channelStrip.gainNode.gain.value,
                pan: channelStrip.panNode.pan.value
            })
        }).then(response => {
            if (!response.ok) {
                console.error('Failed to upload audio params');
            }
        }).catch(err => {
            console.error('Error uploading audio params:', err);
        });
    }
    
</script>
<div class="channel-strip-main">

{#if channelStrip}
    <button class="strip-name-ele" on:click={()=>{clientModel.finalBellRinger?.ringBell()}} style="border-color: {clientModel.config.theme.rimColor};">
        {channelStrip.client.config.teamName}
    </button>
    <div style="width: 6em;">
        <div>
            <div style="text-align: center;" class="strip-name-ele">
                <div>Pan</div>
                <div>
                    {formatPan(channelStrip.panNode.pan.value)}
                </div>
            </div>
        </div>
    
        <HSlider bind:value={channelStrip.panNode.pan.value} min={-1} max={1} step={0.1} onchange={(value) => { uploadAudioParams() }} />
    </div>
    <div>
        <div style="text-align: center;" class="strip-name-ele">
            <div>Gain</div>
            <div>
                {formatGain(channelStrip.gainNode.gain.value)}
            </div>
        </div>
        <div style="margin: auto; width: fit-content; height: 200px; padding: 8px 0;">
            <VSlider bind:value={channelStrip.gainNode.gain.value} min={-60} max={12} step={1} logarithmic onchange={(value) => { uploadAudioParams() }} />
        </div>
    </div>
{/if}
</div>

<style>
    .strip-name-ele {
        width: 100%;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        margin-bottom: 8px;
        background-color: var(--theme-slider-accent);
        color: #4c6851;
        padding: 4px;
        text-align: center;
        border-radius: 3px;
        box-shadow: 0px 2px 8px 0px #0009 inset;
        border: 3px solid var(--theme-slider-trim);
    }

    .channel-strip-main {
        width: fit-content;
        background-color: rgb(50, 50, 54);
        padding: 6px;
        border: 4px solid var(--theme-slider-trim);
        border-radius: 8px;
        box-shadow: 0 0 10px #0006 inset, 0px 4px 8px 0px #0009;
    }
</style>