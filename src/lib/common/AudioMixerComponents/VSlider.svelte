
<script lang="ts">
    export let value: number = 1; // linear value (0..1)
    export let min: number = 0;
    export let max: number = 100;
    export let step: number = 1;
    export let logarithmic: boolean = false;
    export let onchange: (value: number) => void = () => {};
    export let onchangefinished: (value: number) => void = () => {};

    // Internal slider value
    let sliderValue = value;

    // Use min/max for both modes
    $: if (logarithmic) {
        // When value changes externally, update sliderValue (dB)
        sliderValue = value > 0 ? 20 * Math.log10(value) : min;
    } else {
        sliderValue = value;
    }

    function updateValueFromEvent(e: Event) {
        const v = parseFloat((e.target as HTMLInputElement).value);
        value = logarithmic ? Math.pow(10, v / 20) : v;
        return value;
    }

    // Live updates while dragging.
    function handleInput(e: Event) {
        onchange(updateValueFromEvent(e));
    }

    // Fires when the user finishes the change (typically on release).
    function handleChange(e: Event) {
        onchangefinished(updateValueFromEvent(e));
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
    on:change={handleChange}
    style=""
    class="vertical-slider"
/>
