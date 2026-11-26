<script lang="ts">
    import MaterialIcon from "$lib/icons/MaterialIcon.svelte";
    import { moneyBagIcon } from "$lib/icons/material.js";

    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<!-- A drawstring bag, as tokens are drawn from -->
<MaterialIcon icon={moneyBagIcon} {size} {color}/>
