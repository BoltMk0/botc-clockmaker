
<script lang="ts">
    let {
        value = $bindable(1), // linear value (0..1)
        min = 0,
        max = 100,
        step = 1,
        logarithmic = false,
        onchange = () => {},
        onchangefinished = () => {}
    }: {
        value?: number;
        min?: number;
        max?: number;
        step?: number;
        logarithmic?: boolean;
        onchange?: (value: number) => void;
        onchangefinished?: (value: number) => void;
    } = $props();

    // Internal slider value
    let sliderValue = $state(value);

    // Use min/max for both modes
    $effect(() => {
        if (logarithmic) {
            // When value changes externally, update sliderValue (dB)
            sliderValue = value > 0 ? 20 * Math.log10(value) : min;
        } else {
            sliderValue = value;
        }
    });

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
    oninput={handleInput}
    onchange={handleChange}
    style=""
    class="vertical-slider"
/>
