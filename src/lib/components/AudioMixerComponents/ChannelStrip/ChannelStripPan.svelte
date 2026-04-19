<script lang="ts">
    import type { Writable } from "svelte/store";
    import AudioMixerText from "../AudioMixerText.svelte";
    import { formatPan } from "../util";
    import HSlider from "../HSlider.svelte";
    export let pan: number;
    export let onchange: (value: number) => void;

</script>

<div>
    <AudioMixerText>Pan<br/>{formatPan(pan)}</AudioMixerText>
    <HSlider bind:value={pan} min={-1} max={1} step={0.1} onchange={(value) => { onchange(value) }} />
</div>