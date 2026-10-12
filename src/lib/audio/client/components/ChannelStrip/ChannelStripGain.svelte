<script lang="ts">
    import AudioMixerText from "./AudioMixerText.svelte";
    import { formatGain } from "../util";
    import VSlider from "../VSlider.svelte";
    import VLoudnessMeter from "../VLoudnessMeter.svelte";

    let {
        value = $bindable(0),
        analyserNode = null,
        muted = false,
        onmutetoggle = undefined,
        onchange = undefined
    }: {
        value: number;
        analyserNode?: AnalyserNode|null;
        muted?: boolean;
        onmutetoggle?: ()=>void;
        onchange?: ()=>void;
    } = $props()
</script>

<div>
    <AudioMixerText onclick={onmutetoggle} title={muted ? 'Click to unmute' : 'Click to mute'}>
        Gain<br/>{#if muted}<span style="color: #d00; font-weight: 900;">MUTE</span>{:else}{formatGain(value)}{/if}
    </AudioMixerText>
    <div style="width: 100%; height: 216px; padding: 8px 6px; box-sizing: border-box; display: flex; align-items: stretch;">
        <div style="flex: 1; display: flex; justify-content: center; align-items: stretch;">
            <VSlider bind:value={value} min={-60} max={12} step={1} logarithmic onchange={onchange} />
        </div>
        {#if analyserNode}
        <VLoudnessMeter {analyserNode}/>
        {/if}
    </div>
</div>