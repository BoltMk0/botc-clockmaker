<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { scheduleIcon } from "$lib/icons/material.js";

    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<MaterialIcon icon={scheduleIcon} {size} {color}/>
