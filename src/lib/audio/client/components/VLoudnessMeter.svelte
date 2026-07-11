<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';

	let {
		analyserNode = null,
		height = 200,
		width = 14,
		minDb = -60, // floor shown on the meter (dBFS)
		fftSize = 2048,
		smoothingTimeConstant = 0.8,
		clipThreshold = 0.98, // 0..1 peak amplitude
		clipHoldMs = 800
	}: {
		analyserNode?: AnalyserNode | null;
		height?: number;
		width?: number;
		minDb?: number;
		fftSize?: number;
		smoothingTimeConstant?: number;
		clipThreshold?: number;
		clipHoldMs?: number;
	} = $props();

	let level01 = $state(0); // 0..1 (mapped from dB)
	let isClipping = $state(false);

	let rafId: number | null = null;
	let mounted = $state(false);
	let lastNode: AnalyserNode | null = null;

	let floatTimeData: Float32Array<ArrayBuffer> | null = null;
	let byteTimeData: Uint8Array<ArrayBuffer> | null = null;

	let clipUntil = 0;

	function stopLoop() {
		if (rafId != null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
	}

	function ensureAnalyserConfigured(node: AnalyserNode) {
		if (node.fftSize !== fftSize) node.fftSize = fftSize;
		if (node.smoothingTimeConstant !== smoothingTimeConstant) node.smoothingTimeConstant = smoothingTimeConstant;

		const n = node.fftSize;
		if ('getFloatTimeDomainData' in node) {
			if (!floatTimeData || floatTimeData.length !== n) {
				floatTimeData = new Float32Array(new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT));
			}
			byteTimeData = null;
		} else {
			// Fallback for older implementations.
			if (!byteTimeData || byteTimeData.length !== n) {
				byteTimeData = new Uint8Array(new ArrayBuffer(n * Uint8Array.BYTES_PER_ELEMENT));
			}
			floatTimeData = null;
		}
	}

	function computeLevelAndClip(node: AnalyserNode) {
		let sumSquares = 0;
		let peak = 0;
		const n = node.fftSize;

		if (floatTimeData) {
			node.getFloatTimeDomainData(floatTimeData);
			for (let i = 0; i < n; i++) {
				const s = floatTimeData[i];
				const a = Math.abs(s);
				if (a > peak) peak = a;
				sumSquares += s * s;
			}
		} else if (byteTimeData) {
			node.getByteTimeDomainData(byteTimeData);
			// 0..255 where ~128 is silence.
			for (let i = 0; i < n; i++) {
				const s = (byteTimeData[i] - 128) / 128;
				const a = Math.abs(s);
				if (a > peak) peak = a;
				sumSquares += s * s;
			}
		} else {
			// Shouldn't happen, but avoid NaNs.
			level01 = 0;
			return;
		}

		const rms = Math.sqrt(sumSquares / n);
		const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
		const clampedDb = Math.max(minDb, Math.min(0, rmsDb));
		const nextLevel01 = (clampedDb - minDb) / (0 - minDb);

		// Small additional smoothing so the bar doesn't jitter too much.
		level01 = level01 * 0.7 + nextLevel01 * 0.3;

		const now = performance.now();
		if (peak >= clipThreshold) {
			clipUntil = Math.max(clipUntil, now + clipHoldMs);
		}
		isClipping = now < clipUntil;
	}

	function loop() {
		rafId = requestAnimationFrame(loop);

		const node = analyserNode;
		if (!node) {
			level01 = 0;
			isClipping = false;
			return;
		}

		try {
			ensureAnalyserConfigured(node);
			computeLevelAndClip(node);
		} catch {
			// If the node is detached/invalidated, fail soft.
			level01 = 0;
			isClipping = false;
		}
	}

	function startLoopIfNeeded() {
		if (!browser || !mounted) return;
		if (!analyserNode) {
			stopLoop();
			return;
		}
		if (rafId == null) {
			loop();
		}
	}

	onMount(() => {
		mounted = true;
		startLoopIfNeeded();
	});

	onDestroy(() => {
		mounted = false;
		stopLoop();
	});

	$effect(() => {
		if (mounted && browser && analyserNode !== lastNode) {
			lastNode = analyserNode;
			// Reset state so swapping analysers doesn't show stale values.
			level01 = 0;
			isClipping = false;
			clipUntil = 0;
			floatTimeData = null;
			byteTimeData = null;
			stopLoop();
			startLoopIfNeeded();
		}
	});
</script>

<div
	class="meter"
	style="--meter-h: 100%; --meter-w: 15px;"
	aria-label="Loudness meter"
	title={isClipping ? 'CLIP' : undefined}
>
	<div class="clip-light" class:on={isClipping} aria-hidden="true"></div>
	<div class="track" aria-hidden="true">
		<div class="fill" style="transform: scaleY({Math.max(0, Math.min(1, level01))});"></div>
	</div>
</div>

<style>
	.meter {
		width: var(--meter-w);
		height: var(--meter-h);
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 6px;
		align-items: stretch;
		user-select: none;
	}

	.clip-light {
		height: 10px;
		border-radius: 2px;
		border: 2px solid var(--theme-slider-trim);
		background: #300;
		box-shadow: 0px 2px 8px 0px #0009 inset;
	}

	.clip-light.on {
		background: #900;
	}

	.track {
		position: relative;
		border-radius: 3px;
		border: 3px solid var(--theme-slider-trim);
		background: rgb(50, 50, 54);
		box-shadow: 0 0 10px #0006 inset, 0px 4px 8px 0px #0009;
		overflow: hidden;
	}

	.fill {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		top: 0;
		background: var(--theme-slider-accent);
		transform-origin: bottom;
	}
</style>
