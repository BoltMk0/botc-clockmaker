<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { menuBookIcon } from "$lib/icons/material.js";

    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<!-- The grimoire -->
<MaterialIcon icon={menuBookIcon} {size} {color}/>
