
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
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
}

.vertical-slider::-webkit-slider-runnable-track {
    width: 4px;
    margin-left: 14px;
    background: var(--theme-slider-trim);
    border-radius: 2px;
}

.vertical-slider::-moz-range-track {
    width: 4px;
    margin-left: 14px;
    background: var(--theme-slider-trim);
    border-radius: 2px;
}

.vertical-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 38px;
    margin-left: -8px;
    border-radius: 2px;
    background: linear-gradient(
        to bottom,
        #DDD 0%,
        #DDD 10%,
        #555 11%,
        #EEE 46%,
        hsl(from var(--theme-slider-accent) h calc(s) calc(l*0.5)) 46%,
        var(--theme-slider-accent) 54%,
        white 54%,
        #EEE 66%,
        #777 89%,
        #DDD 90%,
        #DDD 100%
    );
    border: 1px solid var(--theme-shadow);
    box-shadow: 0 3px 5px var(--theme-shadow);
}

.vertical-slider::-moz-range-thumb {
    width: 20px;
    height: 38px;
    margin-left: -8px;
    border-radius: 2px;
    background: linear-gradient(
        to bottom,
        #CCC 0%,
        white 10%,
        #555 11%,
        #EEE 46%,
        hsl(from var(--theme-slider-accent) h calc(s) calc(l*0.5)) 46%,
        var(--theme-slider-accent) 54%,
        white 54%,
        #EEE 66%,
        #777 89%,
        #BBB 90%,
        #CCC 100%
    );
    border: 1px solid var(--theme-shadow);
    box-shadow: 0 3px 5px var(--theme-shadow);
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
