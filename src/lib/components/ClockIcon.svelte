<script lang="ts">
    let { size = 24, color = "currentColor" }: { size?: number; color?: string } = $props();
</script>

<svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">
    <circle cx="12" cy="12" r="9" /><path d="M12 6.5V12l3.5 2" />
</svg>
