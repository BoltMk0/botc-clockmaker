
<script lang="ts">
    export let value: number = 1; // linear value (0..1)
    export let min: number = 0;
    export let max: number = 100;
    export let step: number = 1;
    export let logarithmic: boolean = false;
    export let onchange: (value: number) => void = () => {};

    // Internal slider value
    let sliderValue = value;

    // Use min/max for both modes
    $: if (logarithmic) {
        // When value changes externally, update sliderValue (dB)
        sliderValue = value > 0 ? 20 * Math.log10(value) : min;
    } else {
        sliderValue = value;
    }

    // When slider changes, update value
    function handleInput(e: Event) {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (logarithmic) {
            // Convert dB to linear
            value = Math.pow(10, v / 20);
        } else {
            value = v;
        }
        onchange(value);
    }
</script>

<style>
.vertical-slider {
    writing-mode: vertical-lr; 
    direction: rtl;
    width: 32px;
    height: 100%;
    accent-color: var(--theme-slider-accent);
}
</style>

<input
    type="range"
    min={min}
    max={max}
    step={step}
    value={sliderValue}
    on:input={handleInput}
    style=""
    class="vertical-slider"
/>
