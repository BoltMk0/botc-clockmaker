<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { dialpadIcon } from "$lib/icons/material.js";

    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<!-- A dial pad, for the remote -->
<MaterialIcon icon={dialpadIcon} {size} {color}/>
