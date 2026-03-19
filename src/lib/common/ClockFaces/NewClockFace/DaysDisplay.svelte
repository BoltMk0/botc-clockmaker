<script lang="ts">
    import DisplayPanelBase from "./DisplayPanel/DisplayPanelBase.svelte";

    export let day: number;
    export let title = "Day";
    export let style = "";

    $: dayUnitDigit = Math.floor(day % 10);
    $: dayTensDigit = Math.floor((day % 100) / 10);
</script>

<style>
    .countdown-display-main {
        color: var(--hue);
        text-shadow: 0 0 10px hsl(from var(--hue) h s l / 0.5);
        width: fit-content;
        text-align: center;
        font-size: 1.5em;
        background-color: hsla(from var(--hue) h calc(s/3) calc(l/2) / 0.8);
        padding: 5px;
        border-radius: 10px;
        transition: all 1s;
        border: 3px solid var(--hue);
        box-shadow: 0 0 3px black, 0 5px 10px -5px #0008;

    }

    .countdown-display-grid {
        display: grid;
        height: 100%;
        grid-template-rows: auto 1fr;
        gap: 2px;
    }

    .digit {
        font-size: 3em;
        height: 100%;
        background-color: #2228;
        border-radius: 0 0 5px 5px;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .title-row {
        background-color: #2228;
        border-radius: 5px 5px 0 0;
        padding: 5px 10px;
    }
</style>

<!-- <div class="countdown-display-main dumbledore-font" style="{style}">
    <div class="countdown-display-grid">
        <div class="title-row">{title}</div>
        <div class="digit">{dayUnitDigit}</div>
    </div>
</div> -->

<DisplayPanelBase title={title} style="{style}">
    <div style="font-size: 1.5em; text-shadow: 0 2px 4px #0007; display: flex; align-items: center; justify-content: center; height: 100%;">{dayUnitDigit}</div>
</DisplayPanelBase>