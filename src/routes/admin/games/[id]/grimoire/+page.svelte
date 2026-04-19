<script lang="ts">
    import type { ScriptCharacter, ReminderToken } from "$lib/common/database/types.js";
    import AnotatableView from "$lib/components/AnotatableView.svelte";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import ReminderTokenView from "$lib/components/ReminderTokenView.svelte";
    import { fetchReminderTokensForCharacter } from "$lib/client/database/reminder_tokens";
    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';
    import { ClockClientModel } from "$lib/client/model.js";
    import type { ClockInstanceInfo, Config } from "$lib/common/config.js";
    import { get, writable, type Readable, type Writable } from "svelte/store";
    import FullDisplay from "$lib/components/FullDisplay/FullDisplay.svelte";
    import { onMount } from "svelte";
    import ClockSetter from "../../../[clockid]/ClockSetter.svelte";
    import { derived } from "svelte/store";
    import type { CanvasLayer, CanvasToolType, LayerControls } from "$lib/components/DrawableCanvas2/types.js";
    import AnotatableViewV2 from "$lib/components/DrawableCanvas2/AnotatableViewV2.svelte";
    import type { GrimoireStateSnapshot, PlacedReminder, PlacedToken, SavedReminder, SavedToken } from "./types.js";

    export let data;

    // Token size control
    const showTokenSizeSlider = writable(false);
    const TOKEN_SIZE_KEY = 'grimoire-token-size';
    const initialTokenSize = browser ? Number(localStorage.getItem(TOKEN_SIZE_KEY)) || 150 : 150;
    const tokenSize = writable(initialTokenSize);
    const trayTokenSize = derived(tokenSize, $tokenSize => Math.max(40, Math.round($tokenSize * 0.53)));

    const tools = writable<CanvasToolType[]>(data.gameState?.canvas.tools || [
        {
            type: 'pen',
            color: '#cccccc',
            width: 2,
        },
        {
            type: 'pen',
            color: '#e74c3c',
            width: 2,
        },
        {
            type: 'pen',
            color: '#27ae60',
            width: 2,
        },
        {
            type: 'pen',
            color: '#2980b9',
            width: 2,
        },
        {
            type: 'pen',
            color: '#f1c40f',
            width: 2,
        },
        {
            type: 'eraser',
            width: 4,
        }
    ]);
    const activeTool = writable<CanvasToolType>($tools[0]);

    let canvasLayerController: LayerControls; // Initialized by AnotatableView on mount
    let canvasLayers: Writable<CanvasLayer[]>; // Set on mount by AnotatableView, source of truth for layers
    let activeCanvasLayerIndex: Writable<number>; // Set on mount by AnotatableView, source of truth for active layer index

    // Persist token size to localStorage only after user finishes changing (debounced)
    let tokenSizeSaveTimeout: ReturnType<typeof setTimeout> | null = null;
    function saveTokenSizeDebounced(val: number) {
        if (tokenSizeSaveTimeout) clearTimeout(tokenSizeSaveTimeout);
        tokenSizeSaveTimeout = setTimeout(() => {
            localStorage.setItem(TOKEN_SIZE_KEY, String(val));
            tokenSizeSaveTimeout = null;
        }, 400); // Save 400ms after last change
    }
    if (browser) {
        tokenSize.subscribe(saveTokenSizeDebounced);
    }

    type ClockClientManagerConfig = {
        connectedClock: ClockInstanceInfo|null;
        showClock: boolean;
    }

    class ClockClientManager {
        private config_: Writable<ClockClientManagerConfig>;
        readonly config: Readable<ClockClientManagerConfig>;
        private client_: Writable<ClockClientModel|null> = writable(null);
        readonly client = this.client_ as Readable<ClockClientModel|null>;
        readonly gameId: number;
        private readonly configKey: string;
        constructor(gameId: number){
            this.gameId = gameId;
            this.configKey = `grimoire-${gameId}-clock-config`;
            const storedClockConfig: ClockClientManagerConfig|null = browser ? JSON.parse(localStorage.getItem(this.configKey) ?? 'null') : null;
            this.config_ = writable(storedClockConfig ?? { connectedClock: null, showClock: false });
            this.config = this.config_;
        }

        private saveConfig(){
            if(browser && data.game){
                console.log("Saving clock client manager config");
                const current = get(this.config_);
                localStorage.setItem(this.configKey, JSON.stringify(current));
            }
        }

        closeClient(){
            this.client_.update(client => {
                if(client){
                    console.log("Closing existing clock client connection");
                    client.close();
                }
                return null;
            });
        }

        async initializeClient(){
            try{            
                this.closeClient();
                const clockInstance = get(this.config_).connectedClock;
                if(clockInstance){
                    const newClient = new ClockClientModel(clockInstance.id, clockInstance.config, clockInstance.audioParams);
                    newClient.init();
                    this.client_.set(newClient);
                }
            } catch(er){
                console.error("Error initializing ClockClientModel:", er);
                alert("Failed to initialize clock client: " + er);
            }
        }

        setConnectedClock(clockInfo: ClockInstanceInfo | null) {
            console.log("Setting connected clock to", clockInfo);
            this.config_.update(current => {
                return { connectedClock: clockInfo, showClock: current.showClock };
            });
            this.saveConfig();
            this.initializeClient();
        }

        setVisible(visible: boolean) {
            this.config_.update(current => {
                return { connectedClock: current?.connectedClock ?? null, showClock: visible };
            });
            this.saveConfig();
        }
    }

    const clockClientManager = browser && data.game !== null ? new ClockClientManager(data.game.id) : null;
    const clockClientManagerConfig = clockClientManager ? clockClientManager.config : null;
    const clockClientManagerClient = clockClientManager ? clockClientManager.client : null;
    const showTimerOptions = writable(false);

    
    let gameState: GrimoireStateSnapshot | null = data.gameState;

    let showFooter = writable(false);
    let tokensLocked = writable(browser ? localStorage.getItem(`grimoire-locked-${data.game?.id}`) === 'true' : false);
    let editing = writable(false);


    // When annotate mode is entered: hide tray
    $: if (editing) {
        showFooter.set(false);
    }

    async function takeSnapshotRightNow(){
        if(!data.game){
            return;
        }
        snapshotTimeout.update(current => {
            if(current){
                clearTimeout(current);
            }
            return null;
        });
        const snapshot: GrimoireStateSnapshot = {
            placedTokens,
            placedReminders,
            canvas: {
                layers: get(canvasLayers),
                tools: get(tools),
            },
        };
        try {
            const response = await fetch(`grimoire/state`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(snapshot),
            });
            if (!response.ok) {
                alert('Failed to save grimoire state');
            }
        } catch (er) {
            alert(`Failed to save grimoire state: ${er}`);
        }
    }

    let snapshotTimeout = writable<NodeJS.Timeout | null>(null);
    async function rescheduleSnapshot(){
        snapshotTimeout.update(current => {
            if(current){
                clearTimeout(current);
            }
            return null;
        });
        snapshotTimeout.set(setTimeout(() => {
            snapshotTimeout.set(null);
            takeSnapshotRightNow();
        }, 1000));

    }

    function setTokensLocked(val: boolean) {
        tokensLocked.set(val);
        if(get(tokensLocked)){
            showFooter.set(false);
        }
        if (browser && data.game) {
            localStorage.setItem(`grimoire-locked-${data.game.id}`, String(val));
        }
    }

    function toggleTray() {
        showFooter.update((v) => !v);
        if (showFooter) {
            setTokensLocked(false);
            editing.set(false);
        }
    }

    $: storageKey = data.game ? `grimoire-${data.game.id}` : null;
    $: reminderStorageKey = data.game ? `grimoire-reminders-${data.game.id}` : null;

    let placedTokens: PlacedToken[] = data.gameState?.placedTokens ?? loadTokens();
    let placedReminders: PlacedReminder[] = data.gameState?.placedReminders ?? loadReminders();

    // Cache of fetched reminder tokens per character
    let reminderCache: Record<number, ReminderToken[]> = {};

    // Which board token's reminder tray is open
    let activeReminderCharId: number | null = null;
    let activeReminderPos: { x: number; y: number } | null = null;

    function loadTokens(): PlacedToken[] {
        if (!browser || !data.game) return [];
        const key = `grimoire-${data.game.id}`;
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return [];
            const parsed: SavedToken[] = JSON.parse(saved);
            return parsed
                .map((s) => {
                    const character = data.game!.script.characters.find((c: ScriptCharacter) => c.id === s.characterId);
                    return character ? { character, x: s.x, y: s.y } : null;
                })
                .filter((t): t is PlacedToken => t !== null);
        } catch {
            return [];
        }
    }

    function loadReminders(): PlacedReminder[] {
        if (!browser || !data.game) return [];
        const key = `grimoire-reminders-${data.game.id}`;
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return [];
            const parsed: SavedReminder[] = JSON.parse(saved);
            return parsed.map((s) => ({
                token: { id: s.tokenId, character_id: s.characterId, text: s.text },
                x: s.x,
                y: s.y,
            }));
        } catch {
            return [];
        }
    }

    async function loadRemindersForCharacter(characterId: number): Promise<ReminderToken[]> {
        if (reminderCache[characterId]) return reminderCache[characterId];
        const tokens = await fetchReminderTokensForCharacter(characterId);
        reminderCache[characterId] = tokens;
        return tokens;
    }

    $: trayTokens = data.game
        ? data.game.script.characters
        : [];

    $: placedCharIds = new Set(placedTokens.map(t => t.character.id));

    function isInPlay(characterId: number): boolean {
        return placedCharIds.has(characterId);
    }

    $: charactersByFirstNightOrder = placedTokens.filter(c=>c.character.firstNightOrder !== undefined).sort((a, b)=> (b.character.firstNightOrder ?? 0) - (a.character.firstNightOrder ?? 0));
    $: charactersByOtherNightOrder = placedTokens.filter(c=>c.character.otherNightOrder !== undefined).sort((a, b) => (b.character.otherNightOrder ?? 0) - (a.character.otherNightOrder ?? 0));

    $: gameTokens = trayTokens.filter((c: ScriptCharacter) => data.game?.character_ids.includes(c.id));
    $: otherTokens = trayTokens.filter((c: ScriptCharacter) => !data.game?.character_ids.includes(c.id));

    let dragging: { character: ScriptCharacter; source: 'tray' | 'board' } | null = null;
    let draggingReminder: { token: ReminderToken; source: 'popup' | 'board' } | null = null;
    let ghostPos: { x: number; y: number } | null = null;
    let dragOffset: { x: number; y: number } = { x: 0, y: 0 };
    let boardEl: HTMLDivElement;
    let footerEl: HTMLDivElement;

    // Edge threshold in px for deleting reminder tokens
    const EDGE_THRESHOLD = 40;

    // Distinguish tap vs drag
    let pointerStartPos: { x: number; y: number } | null = null;
    let pointerStartToken: PlacedToken | null = null;
    const TAP_THRESHOLD = 10;

    function startDragFromTray(e: PointerEvent, character: ScriptCharacter) {
        e.preventDefault();
        closeReminderTray();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) };
        dragging = { character, source: 'tray' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
    }

    function startDragFromBoard(e: PointerEvent, token: PlacedToken) {
        e.preventDefault();
        if ($tokensLocked) {
            // Still allow tap for reminder tray, just no drag
            pointerStartPos = { x: e.clientX, y: e.clientY };
            pointerStartToken = token;
            return;
        }
        pointerStartPos = { x: e.clientX, y: e.clientY };
        pointerStartToken = token;
    }

    function actuallyStartBoardDrag(e: PointerEvent, token: PlacedToken) {
        if ($tokensLocked) return;
        closeReminderTray();
        const rect = boardEl.getBoundingClientRect();
        const tokenScreenX = rect.left + rect.width / 2 + token.x;
        const tokenScreenY = rect.top + rect.height / 2 + token.y;
        dragOffset = { x: e.clientX - tokenScreenX, y: e.clientY - tokenScreenY };
        dragging = { character: token.character, source: 'board' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        placedTokens = placedTokens.filter(t => t !== token);
        rescheduleSnapshot();
    }

    function startDragReminderFromPopup(e: PointerEvent, token: ReminderToken) {
        e.preventDefault();
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) };
        draggingReminder = { token, source: 'popup' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        closeReminderTray();
    }

    function startDragReminderFromBoard(e: PointerEvent, reminder: PlacedReminder) {
        e.preventDefault();
        e.stopPropagation();
        closeReminderTray();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) };
        draggingReminder = { token: reminder.token, source: 'board' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        placedReminders = placedReminders.filter(r => !(r.token.id === reminder.token.id && r.x === reminder.x && r.y === reminder.y));
        rescheduleSnapshot();
    }

    async function toggleReminderTray(token: PlacedToken) {
        if (activeReminderCharId === token.character.id) {
            closeReminderTray();
            return;
        }
        activeReminderCharId = token.character.id;
        const boardRect = boardEl.getBoundingClientRect();
        // Use the current token size for vertical offset, plus a small gap (10px)
        let tokenSizeVal = 150;
        try {
            tokenSizeVal = $tokenSize;
        } catch {}
        const gap = 10;
        activeReminderPos = {
            x: boardRect.width / 2 + token.x,
            y: boardRect.height / 2 + token.y + tokenSizeVal / 2 + gap, // below the token
        };
        await loadRemindersForCharacter(token.character.id);
        reminderCache = reminderCache; // trigger reactivity
    }

    function closeReminderTray() {
        activeReminderCharId = null;
        activeReminderPos = null;
    }

    function isNearEdge(x: number, y: number): boolean {
        return x < EDGE_THRESHOLD || y < EDGE_THRESHOLD ||
               x > window.innerWidth - EDGE_THRESHOLD ||
               y > window.innerHeight - EDGE_THRESHOLD;
    }

    function onPointerMove(e: PointerEvent) {
        // Check if we should transition from tap-detection to drag
        if (pointerStartPos && pointerStartToken) {
            const dx = e.clientX - pointerStartPos.x;
            const dy = e.clientY - pointerStartPos.y;
            if (Math.abs(dx) > TAP_THRESHOLD || Math.abs(dy) > TAP_THRESHOLD) {
                actuallyStartBoardDrag(e, pointerStartToken);
                pointerStartPos = null;
                pointerStartToken = null;
            }
            return;
        }

        if (!dragging && !draggingReminder) return;
        e.preventDefault();
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
    }

    function onPointerUp(e: PointerEvent) {
        // Handle tap on board token
        if (pointerStartPos && pointerStartToken) {
            const dx = e.clientX - pointerStartPos.x;
            const dy = e.clientY - pointerStartPos.y;
            if (Math.abs(dx) <= TAP_THRESHOLD && Math.abs(dy) <= TAP_THRESHOLD) {
                toggleReminderTray(pointerStartToken);
            }
            pointerStartPos = null;
            pointerStartToken = null;
            return;
        }

        // Handle reminder token drop
        if (draggingReminder) {
            if (boardEl && !isNearEdge(e.clientX, e.clientY)) {
                const boardRect = boardEl.getBoundingClientRect();
                const dropX = e.clientX - dragOffset.x;
                const dropY = e.clientY - dragOffset.y;
                const x = dropX - boardRect.left - boardRect.width / 2;
                const y = dropY - boardRect.top - boardRect.height / 2;
                placedReminders = [...placedReminders, { token: draggingReminder.token, x, y }];
                rescheduleSnapshot();
            }
            // If near edge, it's deleted (not re-added)
            draggingReminder = null;
            ghostPos = null;
            return;
        }

        if (!dragging) return;

        if (boardEl) {
            const boardRect = boardEl.getBoundingClientRect();
            const footerRect = footerEl?.getBoundingClientRect();
            const isOverFooter = footerRect && (
                e.clientX >= footerRect.left && e.clientX <= footerRect.right &&
                e.clientY >= footerRect.top && e.clientY <= footerRect.bottom
            );
            const isOverBoard = !isOverFooter && (
                e.clientX >= boardRect.left && e.clientX <= boardRect.right &&
                e.clientY >= boardRect.top && e.clientY <= boardRect.bottom
            );

            if (isOverBoard && !isNearEdge(e.clientX, e.clientY)) {
                const dropX = e.clientX - dragOffset.x;
                const dropY = e.clientY - dragOffset.y;
                const x = dropX - boardRect.left - boardRect.width / 2;
                const y = dropY - boardRect.top - boardRect.height / 2;
                placedTokens = [...placedTokens, { character: dragging.character, x, y }];
                rescheduleSnapshot();
            }
            // If near edge or over footer: token returns to tray (not re-added)
        }

        dragging = null;
        ghostPos = null;
    }

    function getNightOrder(characterId: number): number | null {
        const index = charactersByFirstNightOrder.findIndex(c=>c.character.id === characterId);
        if(index === -1) return null;
        if(charactersByFirstNightOrder[index].character.firstNightOrder === null) return null;
        return index + 1;
    }

    function resetAllTokens() {
        placedTokens = [];
        placedReminders = [];
        canvasLayers.set([{ strokes: [] }]);
        takeSnapshotRightNow();
        closeReminderTray();
    }


    onMount(()=>{
        if(!data.game){
            return;
        }
        clockClientManager?.initializeClient();
        canvasLayers = canvasLayerController.layers();
        canvasLayers.set(data.gameState?.canvas.layers || [{ strokes: [] }]);
        activeCanvasLayerIndex = canvasLayerController.activeLayerIndex();
        return () => {
            snapshotTimeout.update(current => {
                if(current){
                    clearTimeout(current);
                }
                return null;
            });
            clockClientManager?.closeClient();
        }
    });
</script>

<svelte:window on:pointermove={onPointerMove} on:pointerup={onPointerUp}/>

<style>
    .grimoire-header {
        display: flex;
        gap: 1em;
        justify-content: center;
        align-items: center;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1;
        pointer-events: none;
    }

    .grimoire-board {
        position: absolute;
        inset: 0;
    }

    .board-token {
        position: absolute;
        transform: translate(-50%, -50%);
        cursor: grab;
        touch-action: none;
        user-select: none;
    }

    .board-token:active {
        cursor: grabbing;
    }

    .grimoire-footer {
        transition: transform 0.3s ease;
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        width: 100%;
        background-color: var(--theme-bg-secondary);
        z-index: 2;
    }

    .token-tray-container {
        display: block;
        width: 100%;
        overflow-y: hidden;
        padding: 0.5em;
        height: fit-content;
        box-sizing: border-box;
    }

    .token-tray {
        display: flex;
        gap: 1em;
        padding: 0;
        box-sizing: border-box;
        overflow-x: scroll;
        padding-bottom: 2em;
        scrollbar-gutter: stable both-edges;
        width: fit-content;
        margin: auto;
        max-width: 100%;
    }

    .sub-tray {
        display: grid;
        grid-template-rows: auto auto auto;
        grid-auto-flow: column;
        gap: 0.2em;
        padding: 0.5em;
        align-items: center;
        align-content: flex-start;
        box-sizing: border-box;
    }

    .tray-token {
        flex-shrink: 0;
        cursor: grab;
        touch-action: none;
        user-select: none;
        opacity: 1;
        transition: opacity 0.15s;
    }

    .tray-token:active {
        cursor: grabbing;
    }

    .tray-token.dragging {
        opacity: 0.3;
    }

    .tray-token.in-play {
        opacity: 0.4;
    }

    .drag-ghost {
        position: fixed;
        pointer-events: none;
        z-index: 1000;
        transform: translate(-50%, -50%);
        opacity: 0.8;
    }

    .reminder-popup {
        position: absolute;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.85);
        border-radius: 10px;
        z-index: 10;
        white-space: nowrap;
    }

    .reminder-popup-token {
        cursor: grab;
        touch-action: none;
        user-select: none;
        flex-shrink: 0;
    }

    .reminder-popup-token:active {
        cursor: grabbing;
    }

    .board-reminder {
        position: absolute;
        transform: translate(-50%, -50%);
        cursor: grab;
        touch-action: none;
        user-select: none;
        z-index: 1;
    }

    .board-reminder:active {
        cursor: grabbing;
    }

    .edge-delete-indicator {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999;
        border: 3px solid rgba(255, 60, 60, 0.6);
        border-radius: 0;
        opacity: 0;
        transition: opacity 0.15s;
    }

    .edge-delete-indicator.active {
        opacity: 1;
    }

    .sidebar {
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
        z-index: 10;
    }

    .sidebar-btn {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        border: none;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        touch-action: manipulation;
        transition: background 0.15s;
    }

    .sidebar-btn:hover {
        background: rgba(0, 0, 0, 0.8);
    }

    .sidebar-btn.active {
        background: rgba(80, 140, 255, 0.7);
    }

    .sidebar-btn svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
    }

</style>

{#if data.error || data.game === null}
    <h1>Game Not Found</h1>
    <p>The specified game could not be found.</p>
    <p>{data.error}</p>
{:else}
    <div class="sidebar">
        <!-- Canvas control -->
         <div style="position: relative">
            <button class="sidebar-btn" class:active={$editing} on:click={() => {
                editing.update((v) => !v);
                showTokenSizeSlider.set(false);
                if ($editing) {
                    showFooter.set(false);
                }
            }} title="{$editing ? 'Exit annotate mode' : 'Enter annotate mode'}">
                <svg viewBox="0 0 24 24">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z"/>
                </svg>
            </button>
            {#if $editing}
            <div style="position: absolute; left: 52px; top: 0; display: flex; flex-direction: column; gap: 8px; z-index: 100;">
                <!-- TOOLS -->
                {#each $tools as tool, index}
                    <button class="sidebar-btn" class:active={tool === $activeTool} on:click={() => activeTool.set(tool)} title={tool.type === 'pen' ? `Pen tool (color: ${tool.color})` : 'Eraser tool'}>
                        {#if tool.type === 'pen'}
                            <svg viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="9" fill={tool.color} stroke="currentColor" stroke-width="2"/>
                            </svg>
                        {:else if tool.type === 'eraser'}
                            <svg viewBox="0 0 24 24">
                                <path d="M16.24 3.56L7.05 12.75a2.003 2.003 0 0 0 0 2.83l4.24 4.24c.78.78 2.05.78 2.83 0l9.19-9.19a2.003 2.003 0 0 0 0-2.83L19.07 3.56a2.003 2.003 0 0 0-2.83 0zM5.63 13.34a1.003 1.003 0 0 1 0-1.42l1.41-1.41a1.003 1.003 0 0 1 1.42 0l1.41 1.41a1.003 1.003 0 0 1-1.42 1.42L7.05 14a1.003 1.003 0 0 1-1.42-.08z"/>
                            </svg>
                        {/if}
                    </button>
                {/each}
                <div style="height: 2px; background-color: #FFF9;"></div>
                {#each $canvasLayers as layer, index}
                <div style="position: relative;">
                    <button class="sidebar-btn" class:active={$activeCanvasLayerIndex === index} on:click={() => activeCanvasLayerIndex.set(index)} title={`Activate layer ${index + 1}`}>
                        <div>
                            {index + 1}
                        </div>
                    </button>
                    {#if $activeCanvasLayerIndex === index}

                    <div style="display: flex; gap: 4px; position: absolute; left: 52px; top: 0; z-index: 100;">
                        <!-- Reset button -->
                        <button class="sidebar-btn" on:click={()=>{canvasLayerController.clearLayer(index)}} title="Clear layer">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 5V2M12 22v-3M5.64 5.64l-2.12-2.12M18.36 18.36l-2.12-2.12M1 12H4M20 12h3M5.64 18.36l-2.12 2.12M18.36 5.64l-2.12 2.12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>

                        {#if $canvasLayers.length > 1}

                        <!-- Delete Button -->
                        <button class="sidebar-btn" on:click={()=>{canvasLayers.update(layers => {
                            const newLayers = [...layers];
                            newLayers.splice(index, 1);
                            return newLayers;
                        }); if($activeCanvasLayerIndex === index){
                            activeCanvasLayerIndex.set(0);
                        }}} title="Delete layer">
                            <svg viewBox="0 0 24 28">
                                <rect x="5" y="7" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/>
                                <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" fill="none" stroke="currentColor" stroke-width="2"/>
                                <line x1="10" y1="13" x2="10" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                <line x1="14" y1="13" x2="14" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                <line x1="3" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>

                        {/if}
                    </div>
                    {/if}
                </div>
                {/each}
                <!-- Add layer button -->
                <button class="sidebar-btn" on:click={() => canvasLayerController.createLayer()} title="Add new layer">
                <svg viewBox="0 0 24 24">
                    <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                </button>
            </div>
            {/if}
         </div>

        <!-- Token size control -->
        <div style="position: relative;">
            <button class="sidebar-btn" class:active={$showTokenSizeSlider} on:click={() => {showTokenSizeSlider.set(!$showTokenSizeSlider); editing.set(false)}} title="Adjust token size">
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                    <!-- Dual-ended arrow at 45 degrees, fits inside circle -->
                    <path d="M7 17 L17 7 M15 7 L17 7 L17 9 M7 15 L7 17 L9 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                </svg>
            </button>
            {#if $showTokenSizeSlider}
                <div style="position: absolute; left: 52px; top: 0; height: 180px; display: flex; align-items: center; z-index: 100;">
                    <input type="range" min="80" max="240" step="1" bind:value={$tokenSize} aria-orientation="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 32px; height: 180px; margin-left: 8px; background: transparent;" />
                </div>
            {/if}
        </div>
        
        <!-- Show/Hide token tray -->
        <button class="sidebar-btn" class:active={$showFooter} on:click={toggleTray} title="{$showFooter ? 'Hide' : 'Show'} token tray">
            <svg viewBox="0 0 24 24">
                <circle cx="6" cy="6" r="5" fill="currentColor"/>
                <circle cx="6" cy="18" r="5" fill="currentColor"/>
                <circle cx="18" cy="6" r="5" fill="currentColor"/>
                <circle cx="18" cy="18" r="5" fill="none" stroke="currentColor"/>
            </svg>
        </button>

        <!-- Lock/Unlock token positions -->
        <button class="sidebar-btn" class:active={$tokensLocked} on:click={() => setTokensLocked(!($tokensLocked))} title="{$tokensLocked ? 'Unlock' : 'Lock'} token positions">
            {#if $tokensLocked}
                <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
            {:else}
                <svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>
            {/if}
        </button>

        <!-- Show/Hide clock -->
        <button class="sidebar-btn" class:active={$clockClientManagerConfig?.showClock} on:click={() => clockClientManager?.setVisible(!($clockClientManagerConfig?.showClock ?? false))} title="{$clockClientManagerConfig?.showClock ? 'Hide' : 'Show'} clock">
            <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
                <line x1="12" y1="12" x2="12" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="12" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>

        {#if !$tokensLocked}
        <!-- Reset tokens button -->
        <button class="sidebar-btn" on:click={() => {
            if (confirm('Are you sure you want to reset all tokens?')) resetAllTokens();
        }} title="Reset all tokens">
            <svg viewBox="0 0 24 24">
                <path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 1.3-.42 2.5-1.13 3.47l1.46 1.46C19.07 16.07 20 14.15 20 12c0-4.42-3.58-8-8-8zm-6.87 3.53L3.67 7.07C2.93 7.93 2 9.85 2 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-1.3.42-2.5 1.13-3.47z"/>
            </svg>
        </button>
        {/if}
        
        <!-- Go back -->
        <button class="sidebar-btn" on:click={() => {takeSnapshotRightNow().then(()=>goto(`/admin/games`))} } title="Back to game">
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>

    </div>

    <AnotatableViewV2 remember bind:layerControls={canvasLayerController} tool={$editing ? $activeTool : null} onchange={rescheduleSnapshot}>
    
    <div class="grimoire-board" bind:this={boardEl}>
        {#each placedTokens as token, i (token.character.id + '-' + i)}
            <div
                class="board-token"
                style="left: calc(50% + {token.x}px); top: calc(50% + {token.y}px);"
                on:pointerdown={(e) => startDragFromBoard(e, token)}
            >
                <CharacterToken character={token.character} nightOrder={getNightOrder(token.character.id)} style="position: relative;" size={$tokenSize + 'px'}/>
            </div>
        {/each}

        {#each placedReminders as reminder}
            <div
                class="board-reminder"
                style="left: calc(50% + {reminder.x}px); top: calc(50% + {reminder.y}px);"
                on:pointerdown={(e) => startDragReminderFromBoard(e, reminder)}
            >
                <ReminderTokenView data={reminder.token} size="60px"/>
            </div>
        {/each}

        {#if activeReminderCharId !== null && activeReminderPos && reminderCache[activeReminderCharId]}
            <div class="reminder-popup" style="left: {activeReminderPos.x}px; top: {activeReminderPos.y}px;">
                {#each reminderCache[activeReminderCharId] as rToken (rToken.id)}
                    <div class="reminder-popup-token" on:pointerdown={(e) => startDragReminderFromPopup(e, rToken)}>
                        <ReminderTokenView data={rToken} size="55px"/>
                    </div>
                {/each}
                {#if reminderCache[activeReminderCharId].length === 0}
                    <span style="color: #999; font-size: 0.8em; padding: 4px;">No reminders</span>
                {/if}
            </div>
        {/if}
    </div>

    {#if $clockClientManagerConfig?.showClock}
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 5; color: white; font-size: 2em; text-shadow: 0 0 10px rgba(0,0,0,0.7); z-index: 0;">
            {#if clockClientManagerClient && $clockClientManagerClient}
            <button class="no-button-style" style="position: relative; width: {$tokenSize * 1.5 + 50}px; height: {$tokenSize * 1.5 + 50}px; margin: 0 auto;" on:click={()=>showTimerOptions.set(true)}>
                <FullDisplay model={$clockClientManagerClient} size={$tokenSize * 1.5}/>
            </button>
            {/if}
        </div>
    {/if}
        
    </AnotatableViewV2>

    <div class="grimoire-footer" bind:this={footerEl} style="transform: translateY({$showFooter && !dragging && !draggingReminder ? '0' : '100%'});">
        <div class="token-tray-container">
            <div class="token-tray">
                <!-- Removed reset button from tray -->
                <div>
                    <div style="text-align: center;">In-play</div>
                    <div class="sub-tray">
                        {#each gameTokens as character (character.id)}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character.id === character.id}
                                    class:in-play={isInPlay(character.id)}
                                    on:pointerdown={(e) => startDragFromTray(e, character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={$trayTokenSize + 'px'} norules/>
                                </div>
                        {/each}
                    </div>
                </div>
                <div>
                    <div style="text-align: center;">Other</div>
                    <div class="sub-tray">
                        {#each otherTokens as character (character.id)}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character.id === character.id}
                                    class:in-play={isInPlay(character.id)}
                                    on:pointerdown={(e) => startDragFromTray(e, character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={$trayTokenSize + 'px'} norules/>
                                </div>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </div>

    {#if dragging && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px;">
            <CharacterToken character={dragging.character} style="position: relative;" size={$tokenSize + 'px'}/>
        </div>
        {#if dragging.source === 'board'}
            <div class="edge-delete-indicator" class:active={isNearEdge(ghostPos.x, ghostPos.y)}></div>
        {/if}
    {/if}

    {#if draggingReminder && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px;">
            <ReminderTokenView data={draggingReminder.token} size="60px"/>
        </div>
        <div class="edge-delete-indicator" class:active={isNearEdge(ghostPos.x, ghostPos.y)}></div>
    {/if}

    {#if $showTimerOptions || $clockClientManagerConfig?.showClock && !$clockClientManagerClient}
        <div style="position: absolute;inset: 0; display:flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: 20;" on:click={() => {showTimerOptions.set(false); if ($clockClientManagerConfig?.showClock && !$clockClientManagerClient) clockClientManager?.setVisible(false);}}>
            <div style="background: var(--theme-bg-secondary); padding: 20px; border-radius: 10px; display: flex; flex-direction: column; gap: 10px;" on:click|stopPropagation>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em;">
                    <h2 style="margin: 0;">Clock Controls</h2>
                    <button class="button-style error" on:click={()=>showTimerOptions.set(false)}>X</button>
                </div>
                {#if clockClientManagerClient && $clockClientManagerClient}
                    <ClockSetter model={$clockClientManagerClient} onstart={()=>{showTimerOptions.set(false)}}/>
                    <button class="button-style" on:click={() => clockClientManager?.setConnectedClock(null)}>Disconnect Clock</button>
                {:else}
                    <div>
                        <div>Select Clock</div>
                        {#each data.availableClocks as clock(clock.id)}
                            <button class="button-style" on:click={() => clockClientManager?.setConnectedClock(clock)}>
                                {clock.config.teamName} - {clock.id}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

        </div>
    {/if}
{/if}