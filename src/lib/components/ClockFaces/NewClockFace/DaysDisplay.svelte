<script lang="ts">
    import DisplayPanelBase from "./DisplayPanel/DisplayPanelBase.svelte";

    export let day: number;
    export let title = "Day";
    export let style = "";

    $: dayUnitDigit = Math.floor(day % 10);
    $: dayTensDigit = Math.floor((day % 100) / 10);
</script>

<DisplayPanelBase title={title} style="{style}">
    <div style="font-size: 1.5em; text-shadow: 0 2px 4px #0007; display: flex; align-items: center; justify-content: center; height: 100%;">{dayUnitDigit}</div>
</DisplayPanelBase>