<script lang="ts">
    import HSlider from './HSlider.svelte';
    import VSlider from './VSlider.svelte';
    import { formatGain, formatPan } from './util.js';
    import type { AudioTrackBase } from '$lib/client/audio/AudioTrackBase.js';
    export let title: string;
    export let audioTrack: AudioTrackBase;
    export let onAudioParamsChange: (params: {gain: number, pan: number}) => void = () => {};
    export let onChannelStripTitleClick: () => void = () => {};
    

    let pan = audioTrack.pan;
    let gain = audioTrack.gain;

</script>
<div class="channel-strip-main">

    <button class="strip-name-ele" on:click={onChannelStripTitleClick} style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">
        {title}
    </button>
    <div style="width: 6em;">
        <div>
            <div style="text-align: center;" class="strip-name-ele">
                <div>Pan</div>
                <div>
                    {formatPan($pan)}
                </div>
            </div>
        </div>
    
        <HSlider bind:value={$pan} min={-1} max={1} step={0.1} onchange={(value) => { onAudioParamsChange({gain: $gain, pan: value}) }} />
    </div>
    <div>
        <div style="text-align: center;" class="strip-name-ele">
            <div>Gain</div>
            <div>
                {formatGain($gain)}
            </div>
        </div>
        <div style="margin: auto; width: fit-content; height: 200px; padding: 8px 0;">
            <VSlider bind:value={$gain} min={-60} max={12} step={1} logarithmic onchange={(value) => { onAudioParamsChange({gain: value, pan: $pan}) }} />
        </div>
    </div>
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
        width: 100px;
        background-color: rgb(50, 50, 54);
        padding: 6px;
        border: 4px solid var(--theme-slider-trim);
        border-radius: 8px;
        box-shadow: 0 0 10px #0006 inset, 0px 4px 8px 0px #0009;
    }
</style>