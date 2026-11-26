<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { addIcon } from "$lib/icons/material.js";

    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<MaterialIcon icon={addIcon} {size} {color}/>
