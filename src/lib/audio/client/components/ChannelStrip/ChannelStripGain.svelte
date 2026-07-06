<script lang="ts">
    import AudioMixerText from "../AudioMixerText.svelte";
    import { formatGain } from "../util";
    import VSlider from "../VSlider.svelte";

    let {
        value = $bindable(0),
        onchange = undefined
    }: {
        value: number;
        onchange?: ()=>void;
    } = $props()
</script>

<div>
    <AudioMixerText>
        Gain<br/>{formatGain(value)}
    </AudioMixerText>
    <div style="margin: auto; width: fit-content; height: 200px; padding: 8px 0;">
        <VSlider bind:value={value} min={-60} max={12} step={1} logarithmic onchange={onchange} />
    </div>
</div>