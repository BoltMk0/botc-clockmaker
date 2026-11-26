<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { deleteIcon } from "$lib/icons/material.js";

    let { size = 16, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<MaterialIcon icon={deleteIcon} {size} {color}/>
