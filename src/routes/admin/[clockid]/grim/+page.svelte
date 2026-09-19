<script lang="ts">
    import { alignmentForCategory, CHARACTER_CATEGORIES, type ReminderToken, type ScriptCharacter, type ScriptWithCharacters } from "$lib/resources/common/gameData.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import ReminderTokenView from "$lib/components/ReminderTokenView.svelte";
    import { fetchReminderTokensForCharacter } from "$lib/resources/client/reminderTokens.js";
    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';
    import { Clocktower } from "$lib/model/client/Clocktower.svelte.js";
    import FullDisplay from "$lib/components/FullDisplay/FullDisplay.svelte";
    import { onMount } from "svelte";
    import ClockSetter from "../ClockSetter.svelte";
    import type { CanvasToolType } from "$lib/components/DrawableCanvas2/types.js";
    import AnotatableViewV2 from "$lib/components/DrawableCanvas2/AnotatableViewV2.svelte";
    import PlayerToken from "$lib/components/PlayerToken.svelte";
    import { isPlayerToken, layoutTokensAtDefaultPositions, newGrimoireStateHistory, type Alignment, type GrimoireStateHistory, type GrimoireStateSnapshot, type PlacedReminder, type PlacedToken } from "$lib/resources/common/grimoireState.js";
    import { v7 } from "uuid";
    import type { PageData } from "./$types";

    const z_indecies = {
        tokens: 20,
        // Character-only tokens sit above the drawing but behind every player's token.
        unnamedTokens: 15,
        reminders: 30,
        canvas: 10,
        ui: 50,
        clock: 10
    };

    // Size of the draggable character token in the character overview overlay
    const OVERLAY_TOKEN_SIZE = 96;

    // Size of the central clock, as a multiple of the token size
    const CLOCK_SCALE = 1.0;

    // Ring radii as multiples of the token size, to help line tokens up
    const ALIGNMENT_RING_FACTORS = [1.9, 2.6, 3.3];

    let {data}: {data: PageData} = $props();

    function defaultAlignmentForCharacterId(characterId: string | null): Alignment {
        const char = script?.characters.find(c => c.id === characterId);
        return char ? alignmentForCategory(char.category) : 'good';
    }

    function normaliseSnapshot(snap: GrimoireStateSnapshot): GrimoireStateSnapshot {
        return {
            ...snap,
            placedTokens: snap.placedTokens.map(t => ({
                ...t,
                id: t.id ?? v7(),
                alignment: (t as any).alignment ?? defaultAlignmentForCharacterId(t.characterId),
            })),
        };
    }

    function normaliseHistory(hist: GrimoireStateHistory): GrimoireStateHistory {
        return {
            id: hist.id,
            scriptId: hist.scriptId ?? null,
            loadedPreset: hist.loadedPreset ?? null,
            saveslots: hist.saveslots.map(s => s ? normaliseSnapshot(s) : null),
            present: normaliseSnapshot(hist.present),
        };
    }

    function getLocallyStoredGrimoireState(): GrimoireStateHistory | null {
        if (!browser) return null;
        const key = `grimoire-state-${data.clockid}`;
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return null;
            return JSON.parse(saved) as GrimoireStateHistory;
        } catch {
            return null;
        }
    }

    function getInitialGameState(data: PageData): GrimoireStateHistory {
        const locallySavedState = getLocallyStoredGrimoireState();

        const selectedState = (data.grimoireState?.present.timestamp || 0) > (locallySavedState?.present.timestamp || 0) ? data.grimoireState : locallySavedState;
        if(selectedState) {
            console.log("Using grimoire state with timestamp", selectedState.present.timestamp);
            return normaliseHistory(selectedState);
        } else {
            console.log("No existing grimoire state found, initializing new state");
            return newGrimoireStateHistory(data.clockid);
        }
    }

    // svelte-ignore state_referenced_locally
    const gameState = $state(getInitialGameState(data));

    // SCRIPT / PRESET SELECTION
    let script = $state<ScriptWithCharacters | null>(null);

    $effect(() => {
        const id = gameState.scriptId;
        if (!id) {
            script = null;
            return;
        }
        fetch(`/api/scripts/${id}`).then(r => r.ok ? r.json() : null).then(s => {
            if (gameState.scriptId !== id) return;
            script = s;
        }).catch(() => { if (gameState.scriptId === id) script = null; });
    });

    const loadedPreset = $derived(gameState.loadedPreset);

    const sortedScriptCharacters = $derived(
        [...(script?.characters ?? [])].sort((a, b) => {
            const ac = CHARACTER_CATEGORIES.indexOf(a.category as any);
            const bc = CHARACTER_CATEGORIES.indexOf(b.category as any);
            if (ac !== bc) return ac - bc;
            return a.name.localeCompare(b.name);
        })
    );

    // Synthetic "blank" reminder token (icon only, no text) available for every character.
    // Kept out of the database since it's identical for all characters - just rendered from the character's id.
    function blankReminderTokenId(characterId: string): string {
        return `blank-${characterId}`;
    }
    function blankReminderToken(characterId: string): ReminderToken {
        return { id: blankReminderTokenId(characterId), text: '', textSize: 100 };
    }

    const availableReminderTokens = $derived<Record<string, ReminderToken & {characterId: string}>>(
        script ? Object.fromEntries([
            ...script.characters.flatMap(c => c.reminderTokens.map(t => [t.id, {...t, characterId: c.id}] as const)),
            ...script.characters.map(c => [blankReminderTokenId(c.id), {...blankReminderToken(c.id), characterId: c.id}] as const)
        ]) : {}
    )
    const availableCharacters = $derived<Record<string, ScriptCharacter>>(
        script ? Object.fromEntries(script.characters.map(c => [c.id, c])) : {}
    );

    // STATE SELECTION
    const workingGameSnapshot = $derived<GrimoireStateSnapshot>(gameState.present);


    const canvasLayers = $derived(workingGameSnapshot.canvas.layers); // Set on mount by AnotatableView, source of truth for layers
    // Pinch-zoom / pan of the board (bound to the annotatable view; also works outside draw mode)
    let viewScale = $state(1);
    let viewTx = $state(0);
    let viewTy = $state(0);
    let activeCanvasLayerIndex = $state<number>(0); // Set on mount by AnotatableView, source of truth for active layer index

    // Token size control
    let showTokenSizeSlider = $state(false);
    let sidebarOpen = $state(false);
    const TOKEN_SIZE_KEY = 'grimoire-token-size';
    let tokenSize = $state(browser ? Number(localStorage.getItem(TOKEN_SIZE_KEY)) || 150 : 150);
    const reminderTokenSize = $derived(Math.round(tokenSize * 0.5));
    // Phone-width screen (set from a media query on mount); same breakpoint as the full-screen tray CSS.
    let isMobile = $state(false);
    // Slightly smaller in the full-screen phone tray so more tokens fit per row.
    const trayTokenSize = $derived(Math.max(40, Math.round(tokenSize * 0.53 * (isMobile ? 0.8 : 1))));

    const placedTokens = $derived(gameState.present.placedTokens);
    const placedReminders = $derived(gameState.present.placedReminders);

    // Cache of fetched reminder tokens per character
    let reminderCache = $state< Record<string, ReminderToken[]> >({});

    // Which board token's reminder tray is open
    let activeTokenId = $state<string | null>(null);
    let activeReminderPos = $state<{ x: number; y: number } | null>(null);
    let activeReminderAbove = $state(false);
    let reminderPopupEl = $state<HTMLDivElement | null>(null);
    const activeToken = $derived<PlacedToken | null>(
        activeTokenId === null
            ? null
            : (gameState.present.placedTokens.find(t => t.id === activeTokenId) ?? null)
    );
    const activeCharacterId = $derived(activeToken?.characterId ?? null);

    const tools: CanvasToolType[] = [
        {
            type: 'pen',
            color: '#dddddd',
            width: 1.5,
        },
        {
            type: 'pen',
            color: '#111111',
            width: 1.5,
        },
        {
            type: 'pen',
            color: '#e74c3c',
            width: 1.5,
        },
        {
            type: 'pen',
            color: '#27ae60',
            width: 1.5,
        },
        {
            type: 'pen',
            color: '#2980b9',
            width: 1.5,
        },
        {
            type: 'pen',
            color: '#f1c40f',
            width: 1.5,
        },
        {
            type: 'eraser',
            width: 4,
        }
    ];

    let activeToolIndex = $state<number>(0);
    let activeTool = $derived(tools[activeToolIndex]);


    // Persist token size to localStorage only after user finishes changing (debounced)
    let tokenSizeSaveTimeout: ReturnType<typeof setTimeout> | null = null;
    function saveTokenSizeDebounced(val: number) {
        if (tokenSizeSaveTimeout) clearTimeout(tokenSizeSaveTimeout);
        tokenSizeSaveTimeout = setTimeout(() => {
            localStorage.setItem(TOKEN_SIZE_KEY, String(val));
            tokenSizeSaveTimeout = null;
        }, 400); // Save 400ms after last change
    }

    $effect(()=>{
        if (browser) {
            saveTokenSizeDebounced(tokenSize);
        }
    });

    // CLOCK CONNECTION - always the clock this grim lives under, no manual picker
    let clockClient = $state<Clocktower | null>(null);
    let showClock = $state(true);
    let showTimerOptions = $state(false);

    // NIGHT ORDER LOGIC
    const nightOrderFunction = $derived((clockClient?.day || 0) > 0 ? (c: ScriptCharacter) => c.otherNightOrder : (c: ScriptCharacter) => c.firstNightOrder);
    const nightOrderByCharacterId = $derived((placedTokens
        .filter(c=>!c.isDead)
        .map(c=>script?.characters.find(ch => ch.id === c.characterId))
        .filter(c => c !== undefined)
        .map(c=>{return [c.id, nightOrderFunction(c)]})
        .filter(([_, order])=>order !== null) as [string, number][]).sort((a, b) => a[1] - b[1])
        .map(([id, _])=>id) ?? []);

    let showFooter = $state(false);
    let tokensLocked = $derived(browser ? localStorage.getItem(`grimoire-locked-${data.clockid}`) !== 'false' : true);
    let editing = $state(false);


    // When annotate mode is entered: hide tray
    $effect(()=>{ if (editing) showFooter = false; });

    // Keep the popup on-screen horizontally by clamping its x after measuring its rendered width.
    $effect(() => {
        if (activeTokenId === null || !activeReminderPos || !reminderPopupEl || !boardEl) return;
        // Touch reactive content so the effect re-runs when the popup's contents (and thus width) change.
        void (activeCharacterId && reminderCache[activeCharacterId]);
        void activeToken?.playerName;
        void activeToken?.isDead;
        void activeToken?.alignment;
        const popupRect = reminderPopupEl.getBoundingClientRect();
        const margin = 8;
        const halfWidth = popupRect.width / 2;
        const minX = halfWidth + margin;
        const maxX = window.innerWidth - halfWidth - margin;
        if (maxX < minX) return;
        const clampedX = Math.max(minX, Math.min(maxX, activeReminderPos.x));
        if (clampedX !== activeReminderPos.x) {
            activeReminderPos = { ...activeReminderPos, x: clampedX };
        }
    });

    // Close the reminder popup when tapping anywhere outside a board token, the popup itself, or a board reminder.
    $effect(() => {
        if (activeTokenId === null) return;
        const handler = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('.board-token, .reminder-popup, .board-reminder, .character-overlay')) return;
            closeReminderTray();
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    });

    // Close the token tray when tapping anywhere outside of it (or its opening button).
    $effect(() => {
        if (!showFooter) return;
        const handler = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('.grimoire-footer, .open-tray-btn, .character-overlay')) return;
            showFooter = false;
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    });

    type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';
    let saveStatus = $state<SaveStatus>('saved');

    async function saveGrimoire(){
        if(saveGrimoireTimeout){
            clearTimeout(saveGrimoireTimeout);
            saveGrimoireTimeout = null;
        }

        gameState.present.timestamp = Date.now();
        saveStatus = 'saving';

        if(browser){
            // Also save to localStorage immediately so that if the user reloads before the debounced save, they won't lose more than a few seconds of changes
            localStorage.setItem(`grimoire-state-${data.clockid}`, JSON.stringify(gameState));
        }

        try {
            const response = await fetch(`grim/state`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(gameState),
            });
            if (!response.ok) {
                console.error("Failed to save grimoire state:", response.statusText);
                saveStatus = 'error';
            } else {
                console.log("Grimoire state saved successfully");
                saveStatus = 'saved';
            }
        } catch (er) {
            console.error(`Failed to save grimoire state: ${er}`);
            saveStatus = 'error';
        }
    }

    let saveGrimoireTimeout: NodeJS.Timeout | null = null;
    async function rescheduleSaveGrimoire(){
        saveStatus = 'unsaved';
        if(saveGrimoireTimeout){
            clearTimeout(saveGrimoireTimeout);
        }
        saveGrimoireTimeout = setTimeout(() => {
            saveGrimoireTimeout = null;
            // Don't persist a half-finished drag (the dragged token is temporarily removed from state)
            if (dragging || draggingReminder) {
                rescheduleSaveGrimoire();
                return;
            }
            saveGrimoire();
        }, 1000);
    }

    function quickSaveState(index: number) {
        if (!gameState) return;
        while(gameState.saveslots.length < index + 1){
            gameState.saveslots.push(null);
        }
        gameState.present.timestamp = Date.now();
        const snapshot: GrimoireStateSnapshot = JSON.parse(JSON.stringify(gameState.present)); // Deep copy
        gameState.saveslots[index] = snapshot;
        gameState.present.id = v7();
        gameState.present.previousSnapshotId = snapshot.id;
    }

    function quickLoadState(index: number) {
        if (!gameState) return;
        if(index < 0 || index >= gameState.saveslots.length){
            alert("Invalid snapshot index");
            return;
        }
        const snapshot = gameState.saveslots[index];
        if (!snapshot) return;
        gameState.present = JSON.parse(JSON.stringify(snapshot)); // Deep copy
        gameState.present.previousSnapshotId = snapshot.id;
        gameState.present.id = v7();
        gameState.present.timestamp = Date.now();
    }

    function setTokensLocked(val: boolean) {
        tokensLocked = val;
        if(tokensLocked){
            showFooter = false;
        }
        if (browser) {
            localStorage.setItem(`grimoire-locked-${data.clockid}`, String(val));
        }
    }

    function toggleTray() {
        showFooter = !showFooter;
        if (showFooter) {
            setTokensLocked(false);
            editing = false;
        }
    }

    async function loadRemindersForCharacter(characterId: string): Promise<ReminderToken[]> {
        if (reminderCache[characterId]) return reminderCache[characterId];
        const tokens = await fetchReminderTokensForCharacter(characterId);
        // The blank token is only a fallback for characters with no reminders of their own
        reminderCache[characterId] = tokens.length > 0 ? tokens : [blankReminderToken(characterId)];
        return reminderCache[characterId];
    }

    const placedCharIds = $derived(new Set(placedTokens.map(t => t.characterId).filter(id => id !== null)));

    function isInPlay(characterId: string): boolean {
        return placedCharIds.has(characterId);
    }

    let dragging = $state<{ character: ScriptCharacter | null; source: 'tray' | 'board'; sourceToken?: PlacedToken } | null>(null);
    let draggingReminder = $state<{ token: ReminderToken; characterId: string; source: 'popup' | 'board' } | null>(null);
    let ghostPos = $state<{ x: number; y: number } | null>(null);
    let dragOffset = $state<{ x: number; y: number }>({ x: 0, y: 0 });
    let boardEl = $state<HTMLDivElement | null>(null);
    let footerEl = $state<HTMLDivElement | null>(null);

    // Edge threshold in px for deleting reminder tokens
    const EDGE_THRESHOLD = 40;

    // Distinguish tap vs drag
    let pointerStartPos: { x: number; y: number } | null = null;
    let pointerStartToken: PlacedToken | null = null;
    const TAP_THRESHOLD = 10;

    // Zoom and pan so the placed tokens fill the screen, edge to edge (rings, reminders and the clock are ignored).
    const FIT_PADDING = 8;
    const FIT_MAX_SCALE = 4;
    function fitView() {
        if (!boardEl) return;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const include = (x: number, y: number, half: number) => {
            minX = Math.min(minX, x - half); maxX = Math.max(maxX, x + half);
            minY = Math.min(minY, y - half); maxY = Math.max(maxY, y + half);
        };
        for (const t of placedTokens) include(t.x, t.y, tokenSize / 2);
        if (!isFinite(minX)) { viewScale = 1; viewTx = 0; viewTy = 0; return; }

        const availW = Math.max(1, boardEl.offsetWidth - FIT_PADDING * 2);
        const availH = Math.max(1, boardEl.offsetHeight - FIT_PADDING * 2);
        const scale = Math.min(FIT_MAX_SCALE, availW / (maxX - minX), availH / (maxY - minY));
        viewScale = scale;
        // Screen position = centre + translate + scale * world, so centre the content's middle on the screen centre.
        viewTx = -scale * (minX + maxX) / 2;
        viewTy = -scale * (minY + maxY) / 2;
    }

    // Moves every token back to where the draw first put it (seats round the circle, everything else in the row above).
    function resetTokenPositions() {
        if (placedTokens.length === 0) return;
        if (!confirm("Move all tokens back to their starting positions and resize them to fit?")) return;
        closeReminderTray();
        gameState.present.placedTokens = layoutTokensAtDefaultPositions(
            placedTokens,
            isPlayerToken
        );
        fitTokenSizeToSpacing();
        rescheduleSaveGrimoire();
        fitView();
    }

    // Sets the token size to the largest the slider allows that keeps every token clear of its nearest neighbour.
    const TOKEN_SIZE_MIN = 80;
    const TOKEN_SIZE_MAX = 240;
    const TOKEN_GAP_FACTOR = 0.94;
    function fitTokenSizeToSpacing() {
        let minDist = Infinity;
        const tokens = gameState.present.placedTokens;
        for (let i = 0; i < tokens.length; i++) {
            for (let j = i + 1; j < tokens.length; j++) {
                minDist = Math.min(minDist, Math.hypot(tokens[i].x - tokens[j].x, tokens[i].y - tokens[j].y));
            }
        }
        if (!isFinite(minDist)) return;
        tokenSize = Math.max(TOKEN_SIZE_MIN, Math.min(TOKEN_SIZE_MAX, Math.floor(minDist * TOKEN_GAP_FACTOR)));
    }

    // A second finger landed: whatever tap/drag the first finger was starting is now part of a pinch instead.
    function cancelPendingBoardTap() {
        pointerStartPos = null;
        pointerStartToken = null;
    }

    // Character overview opened by tapping a token in the tray
    let overlayOpen = $state(false);
    let overlayCharacter = $state<ScriptCharacter | null>(null);
    // True when the overlay was opened from a token on the board (adds the alive/good/name controls, drops the character token).
    let overlayFromBoard = $state(false);

    function openCharacterOverlay(character: ScriptCharacter | null, fromBoard = false) {
        overlayOpen = true;
        overlayCharacter = character;
        overlayFromBoard = fromBoard;
        if (character) loadRemindersForCharacter(character.id).then(() => { reminderCache = reminderCache; });
    }

    function closeOverlay() {
        overlayOpen = false;
        overlayCharacter = null;
        pickingCharacter = false;
        overlayFromBoard = false;
        closeReminderTray();
    }

    // The moment a drag starts from the overlay, get the tray and overlay out of the way so the grim shows.
    function startDragCharacterFromOverlay(e: PointerEvent, character: ScriptCharacter) {
        startDragFromTray(e, character);
        dragOffset = { x: 0, y: 0 };
        ghostPos = { x: e.clientX, y: e.clientY };
        overlayOpen = false;
        overlayCharacter = null;
        showFooter = false;
    }

    function startDragReminderFromOverlay(e: PointerEvent, token: ReminderToken, characterId: string) {
        e.preventDefault();
        e.stopPropagation();
        closeReminderTray();
        dragOffset = { x: 0, y: 0 };
        draggingReminder = { token, characterId, source: 'popup' };
        ghostPos = { x: e.clientX, y: e.clientY };
        overlayOpen = false;
        overlayCharacter = null;
        showFooter = false;
    }

    async function showBluffs() {
        await saveGrimoire();
        goto(`/admin/${data.clockid}/grim/bluffs`);
    }

    async function viewCharacter(characterId: string) {
        await saveGrimoire();
        goto(`/admin/${data.clockid}/grim/character/${characterId}`);
    }

    function boardCentre(): { x: number; y: number } {
        const rect = boardEl!.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

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
        if (tokensLocked) {
            // Still allow tap for reminder tray, just no drag
            pointerStartPos = { x: e.clientX, y: e.clientY };
            pointerStartToken = token;
            return;
        }
        pointerStartPos = { x: e.clientX, y: e.clientY };
        pointerStartToken = token;
    }

    function actuallyStartBoardDrag(e: PointerEvent, token: PlacedToken) {
        if (tokensLocked) return;
        if(!boardEl) return;

        const character = script?.characters.find(c => c.id === token.characterId) ?? null;
        if (token.characterId !== null && !character) {
            console.error("Character not found for token:", token);
            return;
        }

        closeReminderTray();
        const centre = boardCentre();
        const tokenScreenX = centre.x + token.x * viewScale;
        const tokenScreenY = centre.y + token.y * viewScale;
        dragOffset = { x: e.clientX - tokenScreenX, y: e.clientY - tokenScreenY };
        dragging = { character: character, source: 'board', sourceToken: token };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        gameState.present.placedTokens = placedTokens.filter(t => t !== token);
    }

    function startDragReminderFromPopup(e: PointerEvent, token: ReminderToken) {
        e.preventDefault();
        e.stopPropagation();
        if (activeCharacterId === null) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) };
        draggingReminder = { token, characterId: activeCharacterId, source: 'popup' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        closeReminderTray();
    }

    function startDragReminderFromBoard(e: PointerEvent, reminder: PlacedReminder) {
        e.preventDefault();
        e.stopPropagation();
        closeReminderTray();

        const token = availableReminderTokens[reminder.tokenId];
        if (!token) {
            console.error("Reminder token not found for placed reminder:", reminder);
            return;
        }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) };
        draggingReminder = { token, characterId: token.characterId, source: 'board' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        gameState.present.placedReminders = placedReminders.filter(r => !(r.tokenId === reminder.tokenId && r.x === reminder.x && r.y === reminder.y));
    }

    async function toggleReminderTray(token: PlacedToken) {
        const character = script?.characters.find(c => c.id === token.characterId) ?? null;
        if (isMobile) {
            // The alive/good/name handlers work off the active token, so mark it active without showing the popup.
            activeTokenId = token.id;
            activeReminderPos = null;
            openCharacterOverlay(character, true);
            return;
        }
        if (activeTokenId === token.id) {
            closeReminderTray();
            return;
        }
        activeTokenId = token.id;
        if(!boardEl) return;
        const centre = boardCentre();
        // Use the current token size for vertical offset, plus a small gap (10px)
        const gap = 10;
        const halfToken = (tokenSize / 2) * viewScale;
        activeReminderAbove = token.y > 0;
        activeReminderPos = {
            x: centre.x + token.x * viewScale,
            y: activeReminderAbove
                ? centre.y + token.y * viewScale - halfToken - gap
                : centre.y + token.y * viewScale + halfToken + gap,
        };
        if (token.characterId !== null) {
            await loadRemindersForCharacter(token.characterId);
            reminderCache = reminderCache; // trigger reactivity
        }
    }

    function toggleAlive() {
        if (!activeToken) return;
        const target = activeToken;
        gameState.present.placedTokens = gameState.present.placedTokens.map(t =>
            t === target ? { ...t, isDead: !t.isDead } : t
        );
        rescheduleSaveGrimoire();
    }

    function toggleAlignment() {
        if (!activeToken) return;
        const target = activeToken;
        gameState.present.placedTokens = gameState.present.placedTokens.map(t =>
            t === target ? { ...t, alignment: t.alignment === 'evil' ? 'good' : 'evil' } : t
        );
        rescheduleSaveGrimoire();
    }

    function setPlayerName(name: string) {
        if (!activeToken) return;
        const target = activeToken;
        gameState.present.placedTokens = gameState.present.placedTokens.map(t =>
            t === target ? { ...t, playerName: name } : t
        );
        rescheduleSaveGrimoire();
    }

    // Gives the active player a different character (or none), keeping their name, seat and life status.
    let pickingCharacter = $state(false);

    function setCharacter(characterId: string | null) {
        if (!activeToken) return;
        const target = activeToken;
        gameState.present.placedTokens = gameState.present.placedTokens.map(t =>
            t === target ? { ...t, characterId, alignment: defaultAlignmentForCharacterId(characterId) } : t
        );
        if (characterId) loadRemindersForCharacter(characterId).then(() => { reminderCache = reminderCache; });
        closeOverlay();
        closeReminderTray();
        rescheduleSaveGrimoire();
    }

    // Adds a new player (no character yet) just below the town, to be dragged into a seat.
    let newPlayerName = $state('');

    function addPlayer() {
        const name = newPlayerName.trim();
        if (!name) return;
        const offset = placedTokens.filter(isPlayerToken).length % 8;
        gameState.present.placedTokens = [...placedTokens, {
            id: v7(),
            characterId: null,
            isDead: false,
            alignment: 'good',
            x: (offset - 3.5) * tokenSize * 0.3,
            y: tokenSize * 2,
            playerName: name,
        }];
        newPlayerName = '';
        rescheduleSaveGrimoire();
    }

    function closeReminderTray() {
        activeTokenId = null;
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
                const centre = boardCentre();
                const dropX = e.clientX - dragOffset.x;
                const dropY = e.clientY - dragOffset.y;
                const x = (dropX - centre.x) / viewScale;
                const y = (dropY - centre.y) / viewScale;
                gameState.present.placedReminders = [...placedReminders, { tokenId: draggingReminder.token.id, x, y }];
                rescheduleSaveGrimoire();
            }
            // If near edge, it's deleted (not re-added)
            draggingReminder = null;
            ghostPos = null;
            rescheduleSaveGrimoire();
            return;
        }

        if (!dragging) return;

        if (boardEl) {
            const centre = boardCentre();
            const footerRect = footerEl?.getBoundingClientRect();
            const isOverFooter = footerRect && (
                e.clientX >= footerRect.left && e.clientX <= footerRect.right &&
                e.clientY >= footerRect.top && e.clientY <= footerRect.bottom
            );
            // The board rect grows/shrinks with zoom, so test against the screen rather than the rect.
            const isOverBoard = !isOverFooter && (
                e.clientX >= 0 && e.clientX <= window.innerWidth &&
                e.clientY >= 0 && e.clientY <= window.innerHeight
            );

            if (isOverBoard && !isNearEdge(e.clientX, e.clientY)) {
                const dropX = e.clientX - dragOffset.x;
                const dropY = e.clientY - dragOffset.y;
                const x = (dropX - centre.x) / viewScale;
                const y = (dropY - centre.y) / viewScale;
                const newPlacedToken: PlacedToken = dragging.sourceToken
                    ? { ...dragging.sourceToken, x, y }
                    : {
                        id: v7(),
                        characterId: dragging.character?.id ?? null,
                        x, y,
                        isDead: false,
                        alignment: defaultAlignmentForCharacterId(dragging.character?.id ?? null),
                    };
                gameState.present.placedTokens = [...gameState.present.placedTokens, newPlacedToken];
                rescheduleSaveGrimoire();
            }
            // If near edge or over footer: token returns to tray (not re-added)
        }

        dragging = null;
        ghostPos = null;
        rescheduleSaveGrimoire();
    }

    onMount(()=>{
        if(!browser) return;
        clockClient = new Clocktower(data.model);
        fitView();

        // Same breakpoint as the full-screen tray CSS.
        const mobileQuery = window.matchMedia('(max-width: 768px)');
        isMobile = mobileQuery.matches;
        const onMobileChange = (e: MediaQueryListEvent) => { isMobile = e.matches; };
        mobileQuery.addEventListener('change', onMobileChange);

        return () => {
            mobileQuery.removeEventListener('change', onMobileChange);
            if(saveGrimoireTimeout){
                clearTimeout(saveGrimoireTimeout);
            }
            clockClient?.close();
        }
    });

    function clearLayer(index: number){
        if(!workingGameSnapshot) return;
        gameState.present.canvas.layers = gameState.present.canvas.layers.map((layer, i) => {
            if(i === index){
                return { strokes: [] };
            }
            return layer;
        });
        saveGrimoire();
    }

    function addLayer(){
        if(!workingGameSnapshot) return;
        gameState.present.canvas.layers.push({ strokes: [] });
        activeCanvasLayerIndex = gameState.present.canvas.layers.length - 1;
        saveGrimoire();
    }

    function deleteLayer(index: number){
        if(!workingGameSnapshot) return;
        if(gameState.present.canvas.layers.length <= 1){
            alert("Cannot delete the last layer.");
            return;
        }
        gameState.present.canvas.layers = gameState.present.canvas.layers.filter((_, i) => i !== index);
        if(activeCanvasLayerIndex >= gameState.present.canvas.layers.length){
            activeCanvasLayerIndex = gameState.present.canvas.layers.length - 1;
        }
        saveGrimoire();
    }

</script>

<svelte:window onpointermove={onPointerMove} onpointerup={onPointerUp}/>

<style>
    /* Pins the whole grim view to the viewport and clips everything else (e.g. the hidden tray sitting
       below the screen, popups, drag ghosts) so nothing can extend the page's scrollable area. */
    .grim-root {
        position: fixed;
        inset: 0;
        overflow: hidden;
        overscroll-behavior: none;
        /* All touch gestures (pinch/pan/drag) are handled in JS; stop the browser zooming or scrolling the page. */
        touch-action: none;
    }

    .grimoire-board {
        position: absolute;
        inset: 0;
    }

    .alignment-ring {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.015);
        box-sizing: border-box;
        pointer-events: none;
    }

    .board-token {
        position: absolute;
        transform: translate(-50%, -50%);
        cursor: grab;
        touch-action: none;
        user-select: none;
    }

    /* Character tokens with no player name are only reminders, so let them sit back a little. */
    .board-token.unnamed {
        opacity: 0.8;
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
    }

    .token-tray-container {
        display: block;
        width: 100%;
        overflow-y: hidden;
        padding: 0.5em;
        height: fit-content;
        box-sizing: border-box;
    }

    .token-tray-header {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5em;
        padding-bottom: 0.5em;
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
        cursor: pointer;
        /* Tapping opens the character overview, so let the tray scroll under the finger. */
        touch-action: manipulation;
        user-select: none;
        opacity: 1;
        transition: opacity 0.15s;
    }


    .tray-token.dragging {
        opacity: 0.3;
    }

    .tray-token.in-play {
        opacity: 0.4;
    }

    .tray-close-btn {
        display: none;
    }

    .add-player-row {
        display: flex;
        justify-content: center;
        gap: 0.5em;
        padding-bottom: 0.5em;
    }

    .add-player-row input {
        width: 14em;
    }

    .picker-grid {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.4em;
    }

    .show-bluffs-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.6em;
        margin: 0 auto 0.3em;
    }

    .show-bluffs-icon {
        display: flex;
        gap: 2px;
    }

    /* On phones the tray takes over the whole screen and scrolls vertically. */
    @media (max-width: 768px) {
        .grimoire-footer {
            top: 0;
            height: 100%;
        }
        .token-tray-container {
            height: 100%;
            display: flex;
            flex-direction: column;
            padding-bottom: 0;
        }
        .token-tray-header {
            position: relative;
            min-height: 40px;
        }
        .tray-close-btn {
            display: block;
            top: 0;
            right: 0;
        }
        .token-tray {
            flex: 1;
            min-height: 0;
            flex-direction: column;
            gap: 0.5em;
            width: 100%;
            margin: 0;
            overflow-x: hidden;
            overflow-y: auto;
            scrollbar-gutter: auto;
            touch-action: pan-y;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 3em;
        }
        .sub-tray {
            grid-auto-flow: row;
            grid-template-rows: none;
            /* Fixed-width columns (not 1fr) so spare row width doesn't stretch the gaps between tokens. */
            grid-template-columns: repeat(auto-fill, calc(var(--tray-token) + 2px));
            justify-content: center;
            justify-items: center;
            gap: 0.15em;
        }
    }

    .character-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow-y: auto;
        background: rgba(0, 0, 0, 0.75);
    }

    .overlay-panel {
        position: relative;
        margin: auto;
        width: min(92vw, 380px);
        max-height: 92%;
        overflow-y: auto;
        box-sizing: border-box;
        padding: 1.4em 1.2em 1.2em;
        border-radius: 1em;
        background: var(--theme-bg-secondary);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.7em;
        text-align: center;
    }

    .overlay-close {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        cursor: pointer;
    }

    .overlay-icon {
        width: 96px;
        height: 96px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
    }

    .overlay-name {
        font-size: 1.6em;
    }

    .overlay-category {
        text-transform: capitalize;
        opacity: 0.6;
        font-size: 0.85em;
    }

    .overlay-toggles {
        display: flex;
        flex-wrap: nowrap;
        gap: 6px;
    }

    /* Alive / Good / Show share one line, so trim the horizontal padding to fit. */
    .overlay-panel .overlay-toggles > button {
        padding: 16px 16px;
        white-space: nowrap;
    }

    .overlay-panel .popup-toggle {
        font-size: 1em;
        padding: 16px 36px;
    }

    .overlay-panel .button-style {
        padding: 16px 36px;
    }

    .overlay-panel .popup-player-name {
        font-size: 1em;
        padding: 8px 10px;
    }

    /* Sits above the icon, clear of the close button in the corner. */
    .overlay-panel .overlay-player-name {
        width: calc(100% - 80px);
        text-align: center;
    }

    .overlay-rules {
        opacity: 0.9;
        line-height: 1.35;
    }

    .overlay-drag-hint {
        opacity: 0.6;
        font-size: 0.8em;
        margin-top: 0.4em;
    }

    .overlay-tokens {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        align-items: center;
        gap: 0.8em;
    }

    .overlay-drag-token {
        cursor: grab;
        touch-action: none;
        user-select: none;
    }

    .drag-ghost {
        position: fixed;
        pointer-events: none;
        transform: translate(-50%, -50%);
        opacity: 0.8;
    }

    .reminder-popup {
        position: absolute;
        transform: translate(-50%, 0);
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: rgba(0, 0, 0, 0.85);
        border-radius: 10px;
        white-space: nowrap;
    }
    .reminder-popup.above {
        transform: translate(-50%, -100%);
    }

    .popup-meta {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
    }
    .popup-rules {
        max-width: 160px;
        white-space: normal;
        color: #e5e7eb;
        font-size: 0.75em;
        line-height: 1.3;
    }
    .popup-rules-name {
        font-weight: 600;
        margin-bottom: 2px;
        color: #f3f4f6;
    }
    .popup-rules-text {
        opacity: 0.85;
    }
    .popup-toggles {
        display: flex;
        gap: 4px;
        align-items: center;
    }
    .popup-toggle {
        background: #1f2937;
        color: #e5e7eb;
        border: 1px solid #4b5563;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 0.8em;
        font-weight: 600;
        cursor: pointer;
    }
    .popup-toggle.dead {
        background: #3a1515;
        color: #fecaca;
        border-color: #7f1d1d;
    }
    .popup-toggle.evil {
        background: #3a1515;
        color: #fecaca;
        border-color: #7f1d1d;
    }
    .popup-player-name {
        background: #1f2937;
        color: #e5e7eb;
        border: 1px solid #4b5563;
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 0.85em;
        width: 100%;
        box-sizing: border-box;
    }
    .popup-divider {
        width: 1px;
        align-self: stretch;
        background: rgba(255, 255, 255, 0.18);
        margin: 2px 2px;
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

    .board-token.dead :global(img) {
        filter: grayscale(0.7) brightness(0.6);
    }
    .board-token.misaligned :global(img) {
        filter: hue-rotate(180deg);
    }
    .board-token.misaligned.dead :global(img) {
        filter: grayscale(0.7) brightness(0.9) hue-rotate(180deg);
    }
    .board-reminder {
        position: absolute;
        transform: translate(-50%, -50%);
        cursor: grab;
        touch-action: none;
        user-select: none;
    }

    .board-reminder:active {
        cursor: grabbing;
    }

    .edge-delete-indicator {
        position: fixed;
        inset: 0;
        pointer-events: none;
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
        top: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
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

    .save-status {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        color: white;
        pointer-events: none;
    }

    .save-status svg {
        width: 18px;
        height: 18px;
        fill: currentColor;
    }

    .save-status.saved svg {
        fill: #4ade80;
    }

    .save-status.unsaved svg {
        fill: #f1c40f;
    }

    .save-status.error svg {
        fill: #e74c3c;
    }

    .save-status.saving svg {
        animation: save-status-spin 0.9s linear infinite;
    }

    @keyframes save-status-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .open-tray-tab {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 60px;
        height: 38px;
        border: none;
        border-radius: 8px 8px 0 0;
        background: var(--theme-bg-secondary);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        touch-action: manipulation;
        opacity: 0.85;
    }

    .open-tray-tab:hover {
        opacity: 1;
    }

    .open-tray-tab svg {
        width: 22px;
        height: 22px;
        fill: currentColor;
    }

    .script-picker-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .script-picker-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
    }

    .script-picker-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .script-picker-name {
        flex: 1;
        text-align: left;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .script-picker-presets {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-left: 1em;
    }

</style>


    <div class="grim-root">
    <div class="save-status {saveStatus}" style="z-index: {z_indecies.ui};" title={
        saveStatus === 'saved' ? 'All changes saved'
        : saveStatus === 'saving' ? 'Saving…'
        : saveStatus === 'error' ? 'Failed to save changes'
        : 'Unsaved changes'
    }>
        {#if saveStatus === 'saved'}
            <svg viewBox="0 0 24 24"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        {:else if saveStatus === 'saving'}
            <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0 0 20 12c0-4.42-3.58-8-8-8zm-6.7 3.2-1.46-1.46A7.93 7.93 0 0 0 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8z"/></svg>
        {:else if saveStatus === 'error'}
            <svg viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2zm0 15a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm-1-7h2v5h-2v-5z"/></svg>
        {:else}
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6"/></svg>
        {/if}
    </div>

    <div class="sidebar" style="z-index: {z_indecies.ui};">
        <!-- Collapse / expand the sidebar -->
        <button class="sidebar-btn" class:active={sidebarOpen} onclick={() => sidebarOpen = !sidebarOpen} title="{sidebarOpen ? 'Hide' : 'Show'} menu">
            {#if sidebarOpen}
                <svg viewBox="0 0 24 24"><path d="M7.41 15.41 12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
            {:else}
                <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            {/if}
        </button>

        {#if sidebarOpen}
        <!-- Canvas control -->
         <div style="position: relative">
            <button class="sidebar-btn" class:active={editing} onclick={() => {
                editing = !editing;
                showTokenSizeSlider = false;
                if (editing) {
                    showFooter = false;
                }
            }} title="{editing ? 'Exit annotate mode' : 'Enter annotate mode'}">
                <svg viewBox="0 0 24 24">
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.83z"/>
                </svg>
            </button>
            {#if editing}
            <div style="position: absolute; left: 52px; top: 0; display: flex; flex-direction: column; gap: 8px;">
                <!-- TOOLS -->
                {#each tools as tool, index}
                    <button class="sidebar-btn" class:active={index === activeToolIndex} onclick={() => activeToolIndex = index} title={tool.type === 'pen' ? `Pen tool (color: ${tool.color})` : 'Eraser tool'}>
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
                {#each canvasLayers as layer, index}
                <div style="position: relative;">
                    <button class="sidebar-btn" class:active={activeCanvasLayerIndex === index} onclick={() => activeCanvasLayerIndex = index} title={`Activate layer ${index + 1}`}>
                        <div>
                            {index + 1}
                        </div>
                    </button>
                    {#if activeCanvasLayerIndex === index}

                    <div style="display: flex; gap: 4px; position: absolute; left: 52px; top: 0;">
                        <!-- Reset button -->
                        <button class="sidebar-btn" onclick={()=>{clearLayer(index)}} title="Clear layer">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 5V2M12 22v-3M5.64 5.64l-2.12-2.12M18.36 18.36l-2.12-2.12M1 12H4M20 12h3M5.64 18.36l-2.12 2.12M18.36 5.64l-2.12 2.12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>

                        {#if canvasLayers.length > 1}

                        <!-- Delete Button -->
                        <button class="sidebar-btn" onclick={()=>{
                            deleteLayer(index);
                        }} title="Delete layer">
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
                <button class="sidebar-btn" onclick={addLayer} title="Add new layer">
                <svg viewBox="0 0 24 24">
                    <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                </button>
            </div>
            {/if}
         </div>

        <!-- Lock/Unlock token positions -->
        <button class="sidebar-btn" class:active={tokensLocked} onclick={() => setTokensLocked(!(tokensLocked))} title="{tokensLocked ? 'Unlock' : 'Lock'} token positions">
            {#if tokensLocked}
                <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
            {:else}
                <svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>
            {/if}
        </button>


        {#if !tokensLocked}
        <!-- Token size control -->
        <div style="position: relative;">
            <button class="sidebar-btn" class:active={showTokenSizeSlider} onclick={() => {showTokenSizeSlider = !showTokenSizeSlider; editing = false}} title="Adjust token size">
                <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/>
                    <!-- Dual-ended arrow at 45 degrees, fits inside circle -->
                    <path d="M7 17 L17 7 M15 7 L17 7 L17 9 M7 15 L7 17 L9 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>
                </svg>
            </button>
            {#if showTokenSizeSlider}
                <div style="position: absolute; left: 52px; top: 0; height: 180px; display: flex; align-items: center;">
                    <input type="range" min={TOKEN_SIZE_MIN} max={TOKEN_SIZE_MAX} step="1" bind:value={tokenSize} aria-orientation="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 32px; height: 180px; margin-left: 8px; background: transparent;" />
                </div>
            {/if}
        </div>
        {/if}

        {#if !tokensLocked}
        <!-- Put all tokens back in their starting positions -->
        <button class="sidebar-btn" onclick={resetTokenPositions} title="Reset token positions and size">
            <svg viewBox="0 0 24 24">
                <circle cx="12" cy="3.5" r="2.2" fill="currentColor"/>
                <circle cx="18" cy="6" r="2.2" fill="currentColor"/>
                <circle cx="20.5" cy="12" r="2.2" fill="currentColor"/>
                <circle cx="18" cy="18" r="2.2" fill="currentColor"/>
                <circle cx="12" cy="20.5" r="2.2" fill="currentColor"/>
                <circle cx="6" cy="18" r="2.2" fill="currentColor"/>
                <circle cx="3.5" cy="12" r="2.2" fill="currentColor"/>
                <circle cx="6" cy="6" r="2.2" fill="currentColor"/>
            </svg>
        </button>
        {/if}

        <!-- Show/Hide clock -->
        <button class="sidebar-btn" class:active={showClock} onclick={() => showClock = !showClock} title="{showClock ? 'Hide' : 'Show'} clock">
            <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>
                <line x1="12" y1="12" x2="12" y2="7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="12" y1="12" x2="16" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
        </button>

        <!-- Refresh page button -->
        <button class="sidebar-btn" onclick={() => location.reload()} title="Refresh page">
            <svg viewBox="0 0 24 24">
                <path d="M12 5V2L8 6l4 4V7c3.31 0 6 2.69 6 6 0 1.3-.42 2.5-1.13 3.47l1.46 1.46C19.07 16.07 20 14.15 20 12c0-4.42-3.58-8-8-8zm-6.87 3.53L3.67 7.07C2.93 7.93 2 9.85 2 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-1.3.42-2.5 1.13-3.47z"/>
            </svg>
        </button>

        <!-- Go back -->
        <button class="sidebar-btn" onclick={() => {saveGrimoire().then(()=>goto(`/admin/${data.clockid}`))} } title="Back to clock">
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>

        {/if}
    </div>

    <AnotatableViewV2 ongesturestart={cancelPendingBoardTap} onresetview={fitView} bind:viewScale bind:viewTx bind:viewTy idleGestures={!dragging && !draggingReminder} idleIgnore=".sidebar, .grimoire-footer, .reminder-popup, [role='dialog']" idlePanIgnore=".board-token, .board-reminder, button, a, input, [role='dialog']" tool={editing ? activeTool : null} onchange={rescheduleSaveGrimoire} layers={canvasLayers} activeLayerIndex={activeCanvasLayerIndex} canvasStyle="z-index: {z_indecies.canvas};">

    <div class="grimoire-board" bind:this={boardEl}>
        {#each ALIGNMENT_RING_FACTORS as factor}
            <div class="alignment-ring" style="width: {tokenSize * factor * 2}px; height: {tokenSize * factor * 2}px; z-index: {z_indecies.canvas - 1};"></div>
        {/each}
        {#each placedTokens as token (token.id)}
            {@const character = script?.characters.find(c => c.id === token.characterId)}
            {#if character || token.characterId === null}
            <div
                class="board-token"
                class:dead={token.isDead}
                class:unnamed={!isPlayerToken(token)}
                class:misaligned={token.characterId !== null && defaultAlignmentForCharacterId(token.characterId) !== token.alignment}
                style="left: calc(50% + {token.x}px); top: calc(50% + {token.y}px); z-index: {isPlayerToken(token) ? z_indecies.tokens : z_indecies.unnamedTokens};"
                onpointerdown={(e) => startDragFromBoard(e, token)}
            >
                {#if character}
                    <CharacterToken {character} nightOrder={nightOrderByCharacterId.indexOf(character.id)} style="position: relative;" size={tokenSize + 'px'} norules dead={token.isDead} playerName={token.playerName?.trim() || undefined}/>
                {:else}
                    <PlayerToken playerName={token.playerName ?? ''} isDead={token.isDead} style="position: relative;" size={tokenSize + 'px'}/>
                {/if}
            </div>
            {/if}
        {/each}

        {#each placedReminders as reminder}
            {@const token = availableReminderTokens[reminder.tokenId]}
            {#if token}
            <div
                class="board-reminder"
                style="left: calc(50% + {reminder.x}px); top: calc(50% + {reminder.y}px); z-index: {z_indecies.reminders};"
                onpointerdown={(e) => startDragReminderFromBoard(e, reminder)}
            >
                <ReminderTokenView data={token} characterId={token.characterId} size="{reminderTokenSize}px"/>
            </div>
            {/if}
        {/each}

    </div>

    {#if showClock}
        <!-- The clock face itself ignores pointer input (so panning/dragging works over it); only a button over its centre 50% opens the timer options. -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 2em; text-shadow: 0 0 10px rgba(0,0,0,0.7); z-index: {z_indecies.clock}; pointer-events: none;">
            {#if clockClient}
            <div style="position: relative; width: {tokenSize * CLOCK_SCALE + 35}px; height: {tokenSize * CLOCK_SCALE + 35}px; margin: 0 auto;">
                <FullDisplay model={clockClient} size={tokenSize * CLOCK_SCALE} displayMode='original'/>
                <button class="no-button-style" aria-label="Clock controls" style="position: absolute; top: 25%; left: 25%; width: 50%; height: 50%; border-radius: 50%; pointer-events: auto;" onclick={()=>showTimerOptions = true}></button>
            </div>
            {/if}
        </div>
    {/if}


    </AnotatableViewV2>


        {#if activeTokenId !== null && activeReminderPos && (activeCharacterId === null || reminderCache[activeCharacterId])}
            <div bind:this={reminderPopupEl} class="reminder-popup" class:above={activeReminderAbove} style="font-size: {tokenSize * 0.12}px; left: {activeReminderPos.x}px; top: {activeReminderPos.y}px; z-index: {z_indecies.ui};">
                {#if activeToken}
                    {@const activeChar = script?.characters.find(c => c.id === activeCharacterId)}
                    <div class="popup-meta">
                        <input
                            type="text"
                            class="popup-player-name"
                            placeholder="Player name"
                            value={activeToken.playerName ?? ''}
                            oninput={(e) => setPlayerName((e.target as HTMLInputElement).value)}
                            onpointerdown={(e) => e.stopPropagation()}
                        />
                        <div class="popup-toggles">
                            <button type="button" class="popup-toggle" class:dead={activeToken.isDead} onclick={toggleAlive}>
                                {activeToken.isDead ? 'Dead' : 'Alive'}
                            </button>
                            <button type="button" class="popup-toggle" class:evil={activeToken.alignment === 'evil'} onclick={toggleAlignment}>
                                {activeToken.alignment === 'evil' ? 'Evil' : 'Good'}
                            </button>
                            {#if activeChar}
                                <button type="button" class="popup-toggle" onclick={() => viewCharacter(activeChar.id)}>Show</button>
                            {/if}
                        </div>
                        <button type="button" class="popup-toggle" onclick={() => pickingCharacter = true}>
                            {activeChar ? 'Change character' : 'Choose character'}
                        </button>
                        {#if activeChar?.rules}
                            <div class="popup-rules">
                                <div class="popup-rules-name">{activeChar.name}</div>
                                <div class="popup-rules-text">{activeChar.rules}</div>
                            </div>
                        {/if}
                    </div>
                    <div class="popup-divider"></div>
                {/if}
                {#if activeCharacterId !== null}
                    {#each reminderCache[activeCharacterId] ?? [] as rToken (rToken.id)}
                        <div class="reminder-popup-token" onpointerdown={(e) => startDragReminderFromPopup(e, rToken)}>
                            <ReminderTokenView data={rToken} characterId={activeCharacterId} size="{reminderTokenSize}px"/>
                        </div>
                    {/each}
                    {#if (reminderCache[activeCharacterId] ?? []).length === 0}
                        <span style="color: #999; font-size: 0.8em; padding: 4px;">No reminders</span>
                    {/if}
                {/if}
            </div>
        {/if}

    {#if !showFooter}
        <button class="open-tray-btn open-tray-tab" onclick={toggleTray} title="Show token tray" style="z-index: {z_indecies.ui};">
            <svg viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
        </button>
    {/if}

    <!-- FOOTER -->
    <div class="grimoire-footer" bind:this={footerEl} style="--tray-token: {trayTokenSize}px; transform: translateY({showFooter && !dragging && !draggingReminder ? '0' : '100%'}); z-index: {z_indecies.ui};">
        <div class="token-tray-container">
            <div class="token-tray-header">
                <button class="overlay-close tray-close-btn" onclick={() => showFooter = false} aria-label="Close">✕</button>
                {#if script}
                    <div style="opacity: 0.7;">{script.name}</div>
                {/if}
            </div>
            <form class="add-player-row" onsubmit={(e) => { e.preventDefault(); addPlayer(); }}>
                <input type="text" class="popup-player-name" placeholder="New player name" bind:value={newPlayerName} />
                <button type="submit" class="button-style" disabled={!newPlayerName.trim()}>Add player</button>
            </form>
            <div class="token-tray">
                {#if !script}
                    <div style="text-align: center; opacity: 0.6; padding: 1em;">Select a script to begin.</div>
                {:else if loadedPreset}
                {#if loadedPreset.character_ids.length > 0}
                <div>
                    <div style="text-align: center;">In-play</div>
                    <div class="sub-tray">
                        {#each loadedPreset.character_ids as character_id}
                        {@const character = script?.characters.find(c => c.id === character_id)}
                        {#if character}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character?.id === character.id}
                                    class:in-play={isInPlay(character.id)}
                                    onclick={() => openCharacterOverlay(character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={trayTokenSize + 'px'} norules/>
                                </div>
                        {/if}
                        {/each}
                    </div>
                </div>
                {/if}
                {#if loadedPreset.bluff_ids.length > 0}
                <div>
                    <div style="text-align: center;">Bluffs</div>
                    <button class="button-style show-bluffs-btn" onclick={showBluffs} title="Show bluffs">
                        <span class="show-bluffs-icon">
                            {#each loadedPreset.bluff_ids.slice(0, 3) as bluffId (bluffId)}
                                {@const bluff = script?.characters.find(c => c.id === bluffId)}
                                {#if bluff}
                                    <div style="position: relative; width: 32px; height: 32px;">
                                        <CharacterToken character={bluff} style="position: relative;" size="32px" norules/>
                                    </div>
                                {/if}
                            {/each}
                        </span>
                        Show bluffs
                    </button>
                    <div class="sub-tray">
                        {#each loadedPreset.bluff_ids as character_id}
                        {@const character = script?.characters.find(c => c.id === character_id)}
                        {#if character}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character?.id === character_id}
                                    class:in-play={isInPlay(character_id)}
                                    onclick={() => openCharacterOverlay(character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={trayTokenSize + 'px'} norules/>
                                </div>
                        {/if}
                        {/each}
                    </div>
                </div>
                {/if}
                <div>
                    <div style="text-align: center;">Other</div>
                    <div class="sub-tray">
                        {#each script.characters.filter(c => !loadedPreset?.character_ids.includes(c.id) && !loadedPreset?.bluff_ids.includes(c.id)) as character (character.id)}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character?.id === character.id}
                                    class:in-play={isInPlay(character.id)}
                                    onclick={() => openCharacterOverlay(character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={trayTokenSize + 'px'} norules/>
                                </div>
                        {/each}
                    </div>
                </div>
                {:else}
                <div>
                    <div style="text-align: center;">All Characters</div>
                    <div class="sub-tray">
                        {#each sortedScriptCharacters as character (character.id)}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character?.id === character.id}
                                    class:in-play={isInPlay(character.id)}
                                    onclick={() => openCharacterOverlay(character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={trayTokenSize + 'px'} norules/>
                                </div>
                        {/each}
                    </div>
                </div>
                {/if}
            </div>
        </div>
    </div>

    {#if overlayOpen}
        {@const oc = overlayCharacter}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="character-overlay" role="dialog" tabindex="-1" style="z-index: {z_indecies.ui + 10};" onclick={(e) => { if (!(e.target as Element).closest('input')) closeOverlay(); }}>
            <div class="overlay-panel">
                <button class="overlay-close" onclick={closeOverlay} aria-label="Close">✕</button>
                {#if overlayFromBoard && activeToken}
                    <input
                        type="text"
                        class="popup-player-name overlay-player-name"
                        placeholder="Player name"
                        value={activeToken.playerName ?? ''}
                        oninput={(e) => setPlayerName((e.target as HTMLInputElement).value)}
                    />
                {/if}
                {#if oc}
                    <img class="overlay-icon" src={`/api/characters/${oc.id}/img`} alt="" onerror={(e) => (e.currentTarget as HTMLImageElement).style.display = 'none'} />
                    <div class="overlay-name dumbledore-font">{oc.name}</div>
                    <div class="overlay-category">{oc.category}</div>
                    {#if oc.rules}
                        <div class="overlay-rules">{oc.rules}</div>
                    {/if}
                {:else if activeToken}
                    <div class="overlay-name dumbledore-font">{activeToken.playerName || 'Player'}</div>
                    <div class="overlay-category">No character</div>
                {/if}
                {#if overlayFromBoard && activeToken}
                    <div class="overlay-toggles">
                        <button type="button" class="popup-toggle" class:dead={activeToken.isDead} onclick={() => { toggleAlive(); closeOverlay(); }}>
                            {activeToken.isDead ? 'Dead' : 'Alive'}
                        </button>
                        <button type="button" class="popup-toggle" class:evil={activeToken.alignment === 'evil'} onclick={() => { toggleAlignment(); closeOverlay(); }}>
                            {activeToken.alignment === 'evil' ? 'Evil' : 'Good'}
                        </button>
                        {#if oc}
                            <button type="button" class="button-style" onclick={() => viewCharacter(oc.id)}>Show</button>
                        {/if}
                    </div>
                    <button type="button" class="button-style" onclick={(e) => { e.stopPropagation(); pickingCharacter = true; }}>
                        {oc ? 'Change character' : 'Choose character'}
                    </button>
                {/if}
                {#if oc}
                    {#if !overlayFromBoard}
                        <button class="button-style" onclick={() => viewCharacter(oc.id)}>Show</button>
                    {/if}
                    <div class="overlay-drag-hint">{overlayFromBoard ? 'Drag a reminder onto the grim' : 'Drag onto the grim'}</div>
                    <div class="overlay-tokens">
                        {#if !overlayFromBoard}
                            <div class="overlay-drag-token" onpointerdown={(e) => startDragCharacterFromOverlay(e, oc)}>
                                <CharacterToken character={oc} style="position: relative;" size="{OVERLAY_TOKEN_SIZE}px" norules/>
                            </div>
                        {/if}
                        {#each reminderCache[oc.id] ?? [] as rToken (rToken.id)}
                            <div class="overlay-drag-token" onpointerdown={(e) => startDragReminderFromOverlay(e, rToken, oc.id)}>
                                <ReminderTokenView data={rToken} characterId={oc.id} size="{OVERLAY_TOKEN_SIZE * 0.7}px"/>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    {#if pickingCharacter && activeToken}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div class="character-overlay" role="dialog" tabindex="-1" style="z-index: {z_indecies.ui + 20};" onclick={() => pickingCharacter = false}>
            <div class="overlay-panel" style="width: min(94vw, 720px);">
                <button class="overlay-close" onclick={() => pickingCharacter = false} aria-label="Close">✕</button>
                <div class="overlay-name dumbledore-font">{activeToken.playerName || 'Player'}</div>
                <div class="overlay-drag-hint">Choose a character</div>
                <div class="picker-grid">
                    {#each sortedScriptCharacters as character (character.id)}
                        <button class="no-button-style tray-token" class:in-play={activeCharacterId !== character.id && isInPlay(character.id)} onclick={(e) => { e.stopPropagation(); setCharacter(character.id); }}>
                            <CharacterToken {character} style="position: relative;" size="{trayTokenSize}px" norules/>
                        </button>
                    {/each}
                </div>
                {#if activeToken.characterId !== null}
                    <button class="button-style" onclick={(e) => { e.stopPropagation(); setCharacter(null); }}>No character</button>
                {/if}
            </div>
        </div>
    {/if}

    {#if dragging && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px; z-index: {z_indecies.ui};">
            {#if dragging.character}
                <CharacterToken character={dragging.character} style="position: relative;" size={tokenSize * viewScale + 'px'} norules/>
            {:else}
                <PlayerToken playerName={dragging.sourceToken?.playerName ?? ''} style="position: relative;" size={tokenSize * viewScale + 'px'}/>
            {/if}
        </div>
        {#if dragging.source === 'board'}
            <div class="edge-delete-indicator" class:active={isNearEdge(ghostPos.x, ghostPos.y)} style="z-index: {z_indecies.ui};"></div>
        {/if}
    {/if}

    {#if draggingReminder && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px;">
            <ReminderTokenView data={draggingReminder.token} characterId={draggingReminder.characterId} size="{reminderTokenSize * viewScale}px"/>
        </div>
        <div class="edge-delete-indicator" class:active={isNearEdge(ghostPos.x, ghostPos.y)}></div>
    {/if}

    {#if showTimerOptions}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div style="position: absolute;inset: 0; display:flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: {z_indecies.ui};" onclick={() => {showTimerOptions = false;}} role="dialog" tabindex="0">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div style="background: var(--theme-bg-secondary); padding: 20px; border-radius: 10px; display: flex; flex-direction: column; gap: 10px;" onclick={(e) => e.stopPropagation()} >
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em; gap: 2em;">
                    <h2 style="margin: 0; padding: 0;">Clock Controls</h2>
                    <button class="button-style error" onclick={()=>{showTimerOptions = false;}}>X</button>
                </div>
                {#if clockClient}
                    <ClockSetter model={clockClient} timerOptions={data.timerOptions} hasGrim={true} onstart={()=>{showTimerOptions = false}}/>
                {:else}
                    <div>Connecting to clock...</div>
                {/if}
            </div>
        </div>
    {/if}
    </div>
