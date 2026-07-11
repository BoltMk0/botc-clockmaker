<script lang="ts">
    import DisplayPanelBase from "./DisplayPanel/DisplayPanelBase.svelte";
    
    let {
        timeRemaining,
        title = "Time Remaining",
        style = ""
    }: {
        timeRemaining: number;
        title?: string;
        style?: string;
    } = $props();

    const minutes = $derived(Math.floor(timeRemaining / 60));
    const seconds = $derived(Math.round(timeRemaining) % 60);
    const timeRemainingString = $derived(`${minutes}:${seconds.toString().padStart(2, '0')}`);
</script>

<DisplayPanelBase title={title} {style}>
    <div style=" text-align: center; font-size: 1.7em; text-shadow: 0 2px 4px #0007; font-family: monospace; font-weight: bold; padding: 10px;">{timeRemainingString}</div>
</DisplayPanelBase>