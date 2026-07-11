<script lang="ts">
    import type { ScriptCharacter, ReminderToken, Character, GameFull } from "$lib/database/common/types.js";
    import CharacterToken from "$lib/components/CharacterToken.svelte";
    import ReminderTokenView from "$lib/components/ReminderTokenView.svelte";
    import { fetchReminderTokensForCharacter } from "$lib/database/client/reminder_tokens.js";
    import { browser } from "$app/environment";

    import { goto } from '$app/navigation';
    import { ClockClientModel } from "$lib/model/client/ClockClientModel.js";
    import type { ClockInstanceInfo } from "$lib/common/config.js";
    import { get, writable, type Readable, type Writable } from "svelte/store";
    import FullDisplay from "$lib/components/FullDisplay/FullDisplay.svelte";
    import { onMount } from "svelte";
    import ClockSetter from "../../../[clockid]/ClockSetter.svelte";
    import type { CanvasToolType } from "$lib/components/DrawableCanvas2/types.js";
    import AnotatableViewV2 from "$lib/components/DrawableCanvas2/AnotatableViewV2.svelte";
    import { newGrimoireStateHistory, type Alignment, type GrimoireStateHistory, type GrimoireStateSnapshot, type PlacedReminder, type PlacedToken } from "./types.js";
    import { v7 } from "uuid";

    const z_indecies = {
        tokens: 20,
        reminders: 30,
        canvas: 10,
        ui: 50,
        clock: 10
    };

    interface Props {
        data: {
            gameid: number;
            game: GameFull|null;
            gameState: GrimoireStateHistory | null;
            availableClocks: ClockInstanceInfo[];
            error: string|null;
        }
    }

    let {data}: Props = $props();

    function defaultAlignmentForCharacterId(characterId: number): Alignment {
        const char = data.game?.script.characters.find(c => c.id === characterId);
        return (char?.category === 'demon' || char?.category === 'minion') ? 'evil' : 'good';
    }

    function normaliseSnapshot(snap: GrimoireStateSnapshot): GrimoireStateSnapshot {
        return {
            ...snap,
            placedTokens: snap.placedTokens.map(t => ({
                ...t,
                alignment: (t as any).alignment ?? defaultAlignmentForCharacterId(t.characterId),
            })),
        };
    }

    function normaliseHistory(hist: GrimoireStateHistory): GrimoireStateHistory {
        return {
            saveslots: hist.saveslots.map(s => s ? normaliseSnapshot(s) : null),
            present: normaliseSnapshot(hist.present),
        };
    }

    function getInitialGameState(data: Props['data']): GrimoireStateHistory {
        const locallySavedState = getLocallyStoredGrimoireState();

        const selectedState = (data.gameState?.present.timestamp || 0) > (locallySavedState?.present.timestamp || 0) ? data.gameState : locallySavedState;
        if(selectedState) {
            console.log("Using grimoire state with timestamp", selectedState.present.timestamp);
            return normaliseHistory(selectedState);
        } else {
            console.log("No existing grimoire state found, initializing new state");
            return newGrimoireStateHistory();
        }
    }

    // svelte-ignore state_referenced_locally
    const gameState = $state(getInitialGameState(data));

    const game = $derived(data.game);
    const availableClocks = $derived(data.availableClocks);

    // Synthetic "blank" reminder token (icon only, no text) available for every character.
    // Kept out of the database since it's identical for all characters - just rendered from the character's id.
    const BLANK_REMINDER_ID_BASE = -1_000_000;
    function blankReminderTokenId(characterId: number): number {
        return BLANK_REMINDER_ID_BASE - characterId;
    }
    function blankReminderToken(characterId: number): ReminderToken {
        return { id: blankReminderTokenId(characterId), character_id: characterId, text: '', textSize: 100 };
    }

    const availableReminderTokens = $derived<Record<number, ReminderToken>>(
        game ? Object.fromEntries([
            ...game.script.characters.flatMap(c => c.reminderTokens.map(t => [t.id, t] as const)),
            ...game.script.characters.map(c => [blankReminderTokenId(c.id), blankReminderToken(c.id)] as const)
        ]) : {}
    )
    const availableCharacters = $derived<Record<number, ScriptCharacter>>(
        game ? Object.fromEntries(game.script.characters.map(c => [c.id, c])) : {}
    );

    // STATE SELECTION
    const workingGameSnapshot = $derived<GrimoireStateSnapshot>(gameState.present);


    const canvasLayers = $derived(workingGameSnapshot.canvas.layers); // Set on mount by AnotatableView, source of truth for layers
    let activeCanvasLayerIndex = $state<number>(0); // Set on mount by AnotatableView, source of truth for active layer index

    // Token size control
    let showTokenSizeSlider = $state(false);
    const TOKEN_SIZE_KEY = 'grimoire-token-size';
    let tokenSize = $state(browser ? Number(localStorage.getItem(TOKEN_SIZE_KEY)) || 150 : 150);
    const reminderTokenSize = $derived(Math.round(tokenSize * 0.5));
    const trayTokenSize = $derived(Math.max(40, Math.round(tokenSize * 0.53)));

    const placedTokens = $derived(gameState.present.placedTokens);
    const placedReminders = $derived(gameState.present.placedReminders);

    // Cache of fetched reminder tokens per character
    let reminderCache = $state< Record<number, ReminderToken[]> >({});

    // Which board token's reminder tray is open
    let activeReminderCharId = $state<number | null>(null);
    let activeReminderPos = $state<{ x: number; y: number } | null>(null);
    let activeReminderAbove = $state(false);
    let reminderPopupEl = $state<HTMLDivElement | null>(null);
    const activeToken = $derived<PlacedToken | null>(
        activeReminderCharId === null
            ? null
            : (gameState.present.placedTokens.find(t => t.characterId === activeReminderCharId) ?? null)
    );

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

    type ClockClientManagerConfig = {
        connectedClock: ClockInstanceInfo|null;
        showClock: boolean;
    }

    class ClockClientManager {
        private config_: Writable<ClockClientManagerConfig>;
        private client_: Writable<ClockClientModel|null> = writable(null);
        readonly config: Readable<ClockClientManagerConfig>;
        readonly client = this.client_ as Readable<ClockClientModel|null>;
        readonly gameId: number;
        private readonly configKey: string;
        constructor(gameId: number){
            this.gameId = gameId;
            this.configKey = `grimoire-${gameId}-clock-config`;
            // const storedClockConfig: ClockClientManagerConfig|null = browser ? JSON.parse(localStorage.getItem(this.configKey) ?? 'null') : null;
            // this.config_ = writable(storedClockConfig ?? { connectedClock: null, showClock: false });
            this.config_ = writable({ connectedClock: null, showClock: true });
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
            // this.saveConfig();
            this.initializeClient();
        }

        setVisible(visible: boolean) {
            this.config_.update(current => {
                return { connectedClock: current?.connectedClock ?? null, showClock: visible };
            });
            // this.saveConfig();
        }
    }

    const clockClientManager = $derived(browser && game !== null ? new ClockClientManager(game.id) : null);
    const clockClientManagerConfig = $derived(clockClientManager ? clockClientManager.config : null);
    const clockClientManagerClient = $derived(clockClientManager ? clockClientManager.client : null);
    const dayInfo = $derived($clockClientManagerClient?.day_info);
    let showTimerOptions = $state(false);

    // NIGHT ORDER LOGIC
    const nightOrderFunction = $derived(($dayInfo?.day || 0) > 0 ? (c: ScriptCharacter) => c.otherNightOrder : (c: ScriptCharacter) => c.firstNightOrder);
    const nightOrderByCharacterId = $derived((placedTokens.filter((c, i, a)=>a.indexOf(c) === i)
        .filter(c=>!c.isDead)
        .map(c=>game?.script.characters.find(ch => ch.id === c.characterId))
        .filter(c => c !== undefined)
        .map(c=>{return [c.id, nightOrderFunction(c)]})
        .filter(([_, order])=>order !== null) as [number, number][]).sort((a, b) => a[1] - b[1])
        .map(([id, _])=>id) ?? []);

    let showFooter = $state(false);
    let tokensLocked = $derived((browser && game) ? localStorage.getItem(`grimoire-locked-${game.id}`) === 'true' : false);
    let editing = $state(false);


    // When annotate mode is entered: hide tray
    $effect(()=>{ if (editing) showFooter = false; });

    // Keep the popup on-screen horizontally by clamping its x after measuring its rendered width.
    $effect(() => {
        if (activeReminderCharId === null || !activeReminderPos || !reminderPopupEl || !boardEl) return;
        // Touch reactive content so the effect re-runs when the popup's contents (and thus width) change.
        void reminderCache[activeReminderCharId];
        void activeToken?.isDead;
        void activeToken?.alignment;
        const boardRect = boardEl.getBoundingClientRect();
        const popupRect = reminderPopupEl.getBoundingClientRect();
        const margin = 8;
        const halfWidth = popupRect.width / 2;
        const minX = halfWidth + margin;
        const maxX = boardRect.width - halfWidth - margin;
        if (maxX < minX) return;
        const clampedX = Math.max(minX, Math.min(maxX, activeReminderPos.x));
        if (clampedX !== activeReminderPos.x) {
            activeReminderPos = { ...activeReminderPos, x: clampedX };
        }
    });

    // Close the reminder popup when tapping anywhere outside a board token, the popup itself, or a board reminder.
    $effect(() => {
        if (activeReminderCharId === null) return;
        const handler = (e: PointerEvent) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (target.closest('.board-token, .reminder-popup, .board-reminder')) return;
            closeReminderTray();
        };
        document.addEventListener('pointerdown', handler, true);
        return () => document.removeEventListener('pointerdown', handler, true);
    });

    async function saveGrimoire(){
        if(!game || !workingGameSnapshot){
            console.error("Cannot save grimoire: game or working snapshot not available");
            return;
        }
        if(saveGrimoireTimeout){
            clearTimeout(saveGrimoireTimeout);
        }

        gameState.present.timestamp = Date.now();

        if(browser){
            // Also save to localStorage immediately so that if the user reloads before the debounced save, they won't lose more than a few seconds of changes
            localStorage.setItem(`grimoire-state-${game.id}`, JSON.stringify(gameState));
        }

        try {
            const response = await fetch(`grimoire/state`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(gameState),
            });
            if (!response.ok) {
                console.error("Failed to save grimoire state:", response.statusText);
            } else {
                console.log("Grimoire state saved successfully");
            }
        } catch (er) {
            console.error(`Failed to save grimoire state: ${er}`);
        }
    }

    function getLocallyStoredGrimoireState(): GrimoireStateHistory | null {
        if (!browser || !data.game) return null;
        const key = `grimoire-state-${data.game.id}`;
        try {
            const saved = localStorage.getItem(key);
            if (!saved) return null;
            return JSON.parse(saved) as GrimoireStateHistory;
        } catch {
            return null;
        }
    }

    let saveGrimoireTimeout: NodeJS.Timeout | null = null;
    async function rescheduleSaveGrimoire(){
        if(saveGrimoireTimeout){
            clearTimeout(saveGrimoireTimeout);
        }
        saveGrimoireTimeout = setTimeout(() => {
            saveGrimoireTimeout = null;
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
        if (browser && data.game) {
            localStorage.setItem(`grimoire-locked-${data.game.id}`, String(val));
        }
    }

    function toggleTray() {
        showFooter = !showFooter;
        if (showFooter) {
            setTokensLocked(false);
            editing = false;
        }
    }

    // function loadTokens(): PlacedToken[] {
    //     if (!browser || !data.game) return [];
    //     const key = `grimoire-${data.game.id}`;
    //     try {
    //         const saved = localStorage.getItem(key);
    //         if (!saved) return [];
    //         const parsed: SavedToken[] = JSON.parse(saved);
    //         return parsed
    //             .map((s) => {
    //                 const character = data.game!.script.characters.find((c: ScriptCharacter) => c.id === s.characterId);
    //                 return character ? { character, x: s.x, y: s.y } : null;
    //             })
    //             .filter((t): t is PlacedToken => t !== null);
    //     } catch {
    //         return [];
    //     }
    // }

    // async function loadReminders(): Promise<PlacedReminder[]> {
    //     if (!browser || !data.game) return [];
    //     const key = `grimoire-reminders-${data.game.id}`;
    //     try {
    //         const saved = localStorage.getItem(key);
    //         if (!saved) return [];
    //         const parsed: SavedReminder[] = JSON.parse(saved);
 
    //         return await Promise.all(parsed.map((s) =>
    //             fetch(`/api/reminder_tokens/${s.tokenId}`).then(res => res.json() as Promise<ReminderToken>).then(token => {
    //                 if (!token) {
    //                     throw new Error(`Failed to load reminder token with id ${s.tokenId}`);
    //                 }
    //                 return {
    //                     token,
    //                     x: s.x,
    //                     y: s.y
    //                 } as PlacedReminder;
    //             })
    //         ));
    //     } catch {
    //         return [];
    //     }
    // }

    async function loadRemindersForCharacter(characterId: number): Promise<ReminderToken[]> {
        if (reminderCache[characterId]) return reminderCache[characterId];
        const tokens = await fetchReminderTokensForCharacter(characterId);
        reminderCache[characterId] = [blankReminderToken(characterId), ...tokens];
        return reminderCache[characterId];
    }

    const trayTokens = $derived(data.game ? data.game.script.characters : []);

    const placedCharIds = $derived(new Set(placedTokens.map(t => t.characterId)));

    function isInPlay(characterId: number): boolean {
        return placedCharIds.has(characterId);
    }

    let dragging = $state<{ character: ScriptCharacter; source: 'tray' | 'board'; sourceToken?: PlacedToken } | null>(null);
    let draggingReminder = $state<{ token: ReminderToken; source: 'popup' | 'board' } | null>(null);
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

        const character = game?.script.characters.find(c => c.id === token.characterId);
        if (!character) {
            console.error("Character not found for token:", token);
            return;
        }

        closeReminderTray();
        const rect = boardEl.getBoundingClientRect();
        const tokenScreenX = rect.left + rect.width / 2 + token.x;
        const tokenScreenY = rect.top + rect.height / 2 + token.y;
        dragOffset = { x: e.clientX - tokenScreenX, y: e.clientY - tokenScreenY };
        dragging = { character: character, source: 'board', sourceToken: token };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        gameState.present.placedTokens = placedTokens.filter(t => t !== token);
        rescheduleSaveGrimoire();
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

        const token = availableReminderTokens[reminder.tokenId];
        if (!token) {
            console.error("Reminder token not found for placed reminder:", reminder);
            return;
        }

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset = { x: e.clientX - (rect.left + rect.width / 2), y: e.clientY - (rect.top + rect.height / 2) };
        draggingReminder = { token, source: 'board' };
        ghostPos = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };
        gameState.present.placedReminders = placedReminders.filter(r => !(r.tokenId === reminder.tokenId && r.x === reminder.x && r.y === reminder.y));
        rescheduleSaveGrimoire();
    }

    async function toggleReminderTray(token: PlacedToken) {
        if (activeReminderCharId === token.characterId) {
            closeReminderTray();
            return;
        }
        activeReminderCharId = token.characterId;
        if(!boardEl) return;
        const boardRect = boardEl.getBoundingClientRect();
        // Use the current token size for vertical offset, plus a small gap (10px)
        const gap = 10;
        activeReminderAbove = token.y > 0;
        activeReminderPos = {
            x: boardRect.width / 2 + token.x,
            y: activeReminderAbove
                ? boardRect.height / 2 + token.y - tokenSize / 2 - gap
                : boardRect.height / 2 + token.y + tokenSize / 2 + gap,
        };
        await loadRemindersForCharacter(token.characterId);
        reminderCache = reminderCache; // trigger reactivity
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
                gameState.present.placedReminders = [...placedReminders, { tokenId: draggingReminder.token.id, x, y }];
                rescheduleSaveGrimoire();
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
                const newPlacedToken: PlacedToken = {
                    characterId: dragging.character.id,
                    x, y,
                    isDead: dragging.sourceToken?.isDead ?? false,
                    alignment: dragging.sourceToken?.alignment ?? defaultAlignmentForCharacterId(dragging.character.id),
                };
                gameState.present.placedTokens = [...gameState.present.placedTokens, newPlacedToken];
                rescheduleSaveGrimoire();
            }
            // If near edge or over footer: token returns to tray (not re-added)
        }

        dragging = null;
        ghostPos = null;
    }

    onMount(()=>{
        if(!game || !workingGameSnapshot){
            alert("Game data failed to load. Please try refreshing the page.");
            return;
        }
        clockClientManager?.initializeClient();
        return () => {
            if(saveGrimoireTimeout){
                clearTimeout(saveGrimoireTimeout);
            }
            clockClientManager?.closeClient();
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
    .token-shroud {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        pointer-events: none;
        border-radius: 50%;
        background:
            radial-gradient(ellipse at 50% 30%, rgba(10, 10, 15, 0.75) 35%, rgba(10, 10, 15, 0.25) 70%, rgba(10, 10, 15, 0) 100%);
        box-shadow: inset 0 0 30px rgba(0, 0, 0, 0.85);
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
        top: 50px;
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

</style>


{#if data.error || game === null}
    <h1>Game Not Found</h1>
    <p>The specified game could not be found.</p>
    <p>{data.error}</p>
{:else}
    <div class="sidebar" style="z-index: {z_indecies.ui};">
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
        
        <!-- Show/Hide token tray -->
        <button class="sidebar-btn" class:active={showFooter} onclick={toggleTray} title="{showFooter ? 'Hide' : 'Show'} token tray">
            <svg viewBox="0 0 24 24">
                <circle cx="6" cy="6" r="5" fill="currentColor"/>
                <circle cx="6" cy="18" r="5" fill="currentColor"/>
                <circle cx="18" cy="6" r="5" fill="currentColor"/>
                <circle cx="18" cy="18" r="5" fill="none" stroke="currentColor"/>
            </svg>
        </button>

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
                    <input type="range" min="80" max="240" step="1" bind:value={tokenSize} aria-orientation="vertical" style="writing-mode: bt-lr; -webkit-appearance: slider-vertical; width: 32px; height: 180px; margin-left: 8px; background: transparent;" />
                </div>
            {/if}
        </div>
        {/if}

        <!-- Show/Hide clock -->
        <button class="sidebar-btn" class:active={$clockClientManagerConfig?.showClock} onclick={() => clockClientManager?.setVisible(!($clockClientManagerConfig?.showClock ?? false))} title="{$clockClientManagerConfig?.showClock ? 'Hide' : 'Show'} clock">
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
        <button class="sidebar-btn" onclick={() => {saveGrimoire().then(()=>goto(`/admin/games`))} } title="Back to game">
            <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>

    </div>

    <AnotatableViewV2 tool={editing ? activeTool : null} onchange={rescheduleSaveGrimoire} layers={canvasLayers} activeLayerIndex={activeCanvasLayerIndex} canvasStyle="z-index: {z_indecies.canvas};">
    
    <div class="grimoire-board" bind:this={boardEl}>
        {#each placedTokens as token, i (token.characterId + '-' + i)}
            {@const character = data.game?.script.characters.find(c => c.id === token.characterId)}
            {#if character}
            <div
                class="board-token"
                class:dead={token.isDead}
                class:misaligned={defaultAlignmentForCharacterId(token.characterId) !== token.alignment}
                style="left: calc(50% + {token.x}px); top: calc(50% + {token.y}px); z-index: {z_indecies.tokens};"
                onpointerdown={(e) => startDragFromBoard(e, token)}
            >
                <CharacterToken {character} nightOrder={nightOrderByCharacterId.indexOf(token.characterId)} style="position: relative;" size={tokenSize + 'px'} norules/>
                {#if token.isDead}
                    <div class="token-shroud" style="width: {tokenSize}px; height: {tokenSize}px; z-index: {z_indecies.tokens + 1};"></div>
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
                <ReminderTokenView data={token} size="{reminderTokenSize}px"/>
            </div>
            {/if}
        {/each}

    </div>

    {#if $clockClientManagerConfig?.showClock}
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-size: 2em; text-shadow: 0 0 10px rgba(0,0,0,0.7); z-index: {z_indecies.clock};">
            {#if clockClientManagerClient && $clockClientManagerClient}
            <button class="no-button-style" style="position: relative; width: {tokenSize * 1.5 + 50}px; height: {tokenSize * 1.5 + 50}px; margin: 0 auto;" onclick={()=>showTimerOptions = true}>
                <FullDisplay model={$clockClientManagerClient} size={tokenSize * 1.5}/>
            </button>
            {/if}
        </div>
    {/if}
    
        
    </AnotatableViewV2>


        {#if activeReminderCharId !== null && activeReminderPos && reminderCache[activeReminderCharId]}
            <div bind:this={reminderPopupEl} class="reminder-popup" class:above={activeReminderAbove} style="font-size: {tokenSize * 0.12}px; left: {activeReminderPos.x}px; top: {activeReminderPos.y}px; z-index: {z_indecies.ui};">
                {#if activeToken}
                    {@const activeChar = data.game?.script.characters.find(c => c.id === activeReminderCharId)}
                    <div class="popup-meta">
                        <div class="popup-toggles">
                            <button type="button" class="popup-toggle" class:dead={activeToken.isDead} onclick={toggleAlive}>
                                {activeToken.isDead ? 'Dead' : 'Alive'}
                            </button>
                            <button type="button" class="popup-toggle" class:evil={activeToken.alignment === 'evil'} onclick={toggleAlignment}>
                                {activeToken.alignment === 'evil' ? 'Evil' : 'Good'}
                            </button>
                        </div>
                        {#if activeChar?.rules}
                            <div class="popup-rules">
                                <div class="popup-rules-name">{activeChar.name}</div>
                                <div class="popup-rules-text">{activeChar.rules}</div>
                            </div>
                        {/if}
                    </div>
                    <div class="popup-divider"></div>
                {/if}
                {#each reminderCache[activeReminderCharId] as rToken (rToken.id)}
                    <div class="reminder-popup-token" onpointerdown={(e) => startDragReminderFromPopup(e, rToken)}>
                        <ReminderTokenView data={rToken} size="{reminderTokenSize}px"/>
                    </div>
                {/each}
                {#if reminderCache[activeReminderCharId].length === 0}
                    <span style="color: #999; font-size: 0.8em; padding: 4px;">No reminders</span>
                {/if}
            </div>
        {/if}

    <!-- FOOTER -->
    <div class="grimoire-footer" bind:this={footerEl} style="transform: translateY({showFooter && !dragging && !draggingReminder ? '0' : '100%'}); z-index: {z_indecies.ui};">
        <div class="token-tray-container">
            <div class="token-tray">
                {#if game.character_ids.length > 0}
                <div>
                    <div style="text-align: center;">In-play</div>
                    <div class="sub-tray">
                        {#each game.character_ids as character_id}
                        {@const character = data.game?.script.characters.find(c => c.id === character_id)}
                        {#if character}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character.id === character.id}
                                    class:in-play={isInPlay(character.id)}
                                    onpointerdown={(e) => startDragFromTray(e, character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={trayTokenSize + 'px'} norules/>
                                </div>
                        {/if}
                        {/each}
                    </div>
                </div>
                {/if}
                {#if game.bluff_ids.length > 0}
                <div>
                    <div style="text-align: center;">Bluffs</div>
                    <div class="sub-tray">
                        {#each game.bluff_ids as character_id}
                        {@const character = data.game?.script.characters.find(c => c.id === character_id)}
                        {#if character}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character.id === character_id}
                                    class:in-play={isInPlay(character_id)}
                                    onpointerdown={(e) => startDragFromTray(e, character)}
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
                        {#each game.script.characters.filter(c => !game?.character_ids.includes(c.id) && !game?.bluff_ids.includes(c.id)) as character (character.id)}
                                <div
                                    class="tray-token"
                                    class:dragging={dragging?.character.id === character.id}
                                    class:in-play={isInPlay(character.id)}
                                    onpointerdown={(e) => startDragFromTray(e, character)}
                                >
                                    <CharacterToken {character} style="position: relative;" size={trayTokenSize + 'px'} norules/>
                                </div>
                        {/each}
                    </div>
                </div>
            </div>
        </div>
    </div>

    {#if dragging && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px; z-index: {z_indecies.ui};">
            <CharacterToken character={dragging.character} style="position: relative;" size={tokenSize + 'px'} norules/>
        </div>
        {#if dragging.source === 'board'}
            <div class="edge-delete-indicator" class:active={isNearEdge(ghostPos.x, ghostPos.y)} style="z-index: {z_indecies.ui};"></div>
        {/if}
    {/if}

    {#if draggingReminder && ghostPos}
        <div class="drag-ghost" style="left: {ghostPos.x}px; top: {ghostPos.y}px;">
            <ReminderTokenView data={draggingReminder.token} size="60px"/>
        </div>
        <div class="edge-delete-indicator" class:active={isNearEdge(ghostPos.x, ghostPos.y)}></div>
    {/if}

    {#if showTimerOptions || ($clockClientManagerConfig?.showClock && $clockClientManagerClient === null)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div style="position: absolute;inset: 0; display:flex; justify-content: center; align-items: center; background: rgba(0,0,0,0.5); z-index: {z_indecies.ui};" onclick={() => {showTimerOptions = false; if ($clockClientManagerConfig?.showClock && !$clockClientManagerClient) clockClientManager?.setVisible(false);}} role="dialog" tabindex="0">
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div style="background: var(--theme-bg-secondary); padding: 20px; border-radius: 10px; display: flex; flex-direction: column; gap: 10px;" onclick={(e) => e.stopPropagation()} >
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5em; gap: 2em;">
                    <h2 style="margin: 0; padding: 0;">{$clockClientManagerClient ? "Clock Controls" : "Connect to Clock"}</h2>
                    <button class="button-style error" onclick={()=>{showTimerOptions = false; if($clockClientManagerClient === null) clockClientManager?.setVisible(false);}}>X</button>
                </div>
                {#if clockClientManagerClient && $clockClientManagerClient}
                    <ClockSetter model={$clockClientManagerClient} onstart={()=>{showTimerOptions = false}}/>
                    <button class="button-style" onclick={() => clockClientManager?.setConnectedClock(null)}>Disconnect Clock</button>
                {:else}
                    <div style="display: flex; flex-direction: column; gap: 5px;">
                        {#each availableClocks as clock(clock.id)}
                            <button class="button-style" onclick={() => {clockClientManager?.setConnectedClock(clock); showTimerOptions = false;}} style="width: 100%; text-align: center; border: 1px solid {typeof clock.config.theme.hue === 'number' ? `hsl(${clock.config.theme.hue} 70% 50%)` : 'currentColor'};">
                                {clock.config.teamName || `${clock.id}`}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
{/if}
