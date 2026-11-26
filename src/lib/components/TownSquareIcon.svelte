<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { castleIcon } from "$lib/icons/material.js";

    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<!-- The town square -->
<MaterialIcon icon={castleIcon} {size} {color}/>
