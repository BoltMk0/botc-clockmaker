<script lang="ts">
    import AudioMixerText from "./AudioMixerText.svelte";
    import { formatGain } from "../util";
    import VSlider from "../VSlider.svelte";
    import VLoudnessMeter from "../VLoudnessMeter.svelte";

    let {
        value = $bindable(0),
        analyserNode = null,
        onchange = undefined
    }: {
        value: number;
        analyserNode?: AnalyserNode|null;
        onchange?: ()=>void;
    } = $props()
</script>

<div>
    <AudioMixerText>
        Gain<br/>{formatGain(value)}
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