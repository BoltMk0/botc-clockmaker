<script lang="ts">
    import AudioMixerText from "../AudioMixerText.svelte";
    import { formatPan } from "../util";
    import HSlider from "../HSlider.svelte";

    let {
        pan = $bindable(0),
        onchange = undefined
    }: {
        pan: number;
        onchange?: (val: number)=>void;
    } = $props()

</script>

<div>
    <AudioMixerText>Pan<br/>{formatPan(pan)}</AudioMixerText>
    <HSlider bind:value={pan} min={-1} max={1} step={0.1} onchange={onchange} />
</div>