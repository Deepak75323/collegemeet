import h from './helpers.js';
import { initCodeCollab, registerCodeCollab } from './code-collab.js';
import { initPeerStudio, runJavaScriptInTerminal } from './peer-studio.js';
import { createCallManager } from './simple-peer-call.js';
import debugLog, { initDebugLog } from './debug-log.js';
import {
    saveRecordingToStore,
    getLatestRecording,
    countRecordings,
    deleteRecordingFromStore,
} from './recording-store.js';
import { getCmDialog } from './confirm-dialog.js';

const { trace, log, warn, error } = debugLog;

window.__rtcLoaded = false;

window.addEventListener( 'load', () => {
    window.__rtcLoaded = true;
    initDebugLog();

    const room = h.getQString( location.href, 'room' );
    const username = sessionStorage.getItem( 'username' );

    log( 'room', 'page load', {
        room: room || '(none)',
        username: username || '(none)',
        simplePeer: typeof window.SimplePeer,
        socketIo: typeof window.io,
        iceTurn: !!window.__ICE_TURN,
        secureContext: window.isSecureContext,
    } );

    trace( 'room', 'load', { room: room || null, username: username || null } );

    if ( !room ) {
        trace( 'room', 'pre-join: create session (no ?room=)' );
        document.querySelector( '#room-create' ).attributes.removeNamedItem( 'hidden' );
    }

    else if ( !username ) {
        trace( 'room', 'pre-join: set username', { room } );
        document.querySelector( '#username-set' ).attributes.removeNamedItem( 'hidden' );
    }

    else {
        trace( 'room', 'entering live session', { room, username } );
        let commElem = document.getElementsByClassName( 'room-comm' );

        for ( let i = 0; i < commElem.length; i++ ) {
            commElem[i].removeAttribute( 'hidden' );
        }

        document.getElementById( 'studio-session' )?.removeAttribute( 'hidden' );

        let codeCollab = null;
        let studioUi = null;

        const remoteStreams = {};
        const knownPeers = new Set();
        let callManager = null;

        function setTroubleshoot( msg ) {
            const el = document.getElementById( 'studio-troubleshoot' );
            if ( el ) el.textContent = msg;
            trace( 'room', 'troubleshoot', { msg } );
        }

        setTroubleshoot( 'Starting session…' );

        const envMsg = h.getMediaEnvironmentMessage();

        if ( envMsg ) {
            setTroubleshoot( envMsg );
            h.updatePipOverlay( { message: 'HTTPS required for camera on this device', showButton: false } );
        }

        h.queryMediaPermissions().then( ( perms ) => {
            log( 'media', 'permission states', perms );
            if ( perms.camera === 'denied' ) {
                h.updatePipOverlay( {
                    message: 'Browser blocked camera for this site — allow in site settings',
                    showButton: true,
                } );
            }
        } );

        let socket = io( '/stream', {
            transports: [ 'websocket', 'polling' ],
            reconnectionAttempts: 8,
            withCredentials: true,
        } );

        socket.on( 'connect_error', ( err ) => {
            trace( 'socket', 'connect_error', { message: err?.message || String( err ) } );
            error( 'socket', 'connect_error', { message: err?.message || String( err ) } );
            const status = document.getElementById( 'studio-connection-status' );
            if ( status ) status.textContent = 'Socket error — check server';
            setTroubleshoot( `Cannot reach server (/stream): ${ err?.message || err }. Is npm run dev running?` );
        } );

        socket.on( 'disconnect', ( reason ) => {
            trace( 'socket', 'disconnect', { reason } );
            warn( 'socket', 'disconnect', { reason } );
            const status = document.getElementById( 'studio-connection-status' );
            if ( status ) status.textContent = `Disconnected (${ reason })`;
        } );

        studioUi = initPeerStudio( {
            room,
            username,
            onRun: async ( terminalEl ) => {
                const langSelect = document.getElementById( 'code-language' );
                const lang = langSelect?.value || 'javascript';
                const code = codeCollab?.getValue() || '';
                const runnerLabel = document.getElementById( 'terminal-runner-label' );
                const runBtn = document.getElementById( 'run-code-btn' );

                function setOutput( text ) {
                    if ( terminalEl ) terminalEl.textContent = text;
                    socket.emit( 'terminal:output', { room, output: text, lang, sender: username } );
                }

                if ( lang === 'javascript' ) {
                    runJavaScriptInTerminal( code, terminalEl );
                    if ( runnerLabel ) runnerLabel.textContent = '· run by you';
                    socket.emit( 'terminal:output', { room, output: terminalEl.textContent, lang, sender: username } );
                    return;
                }

                // Remote execution via Piston API
                if ( runBtn ) { runBtn.disabled = true; runBtn.textContent = '⏳ Running…'; }
                if ( terminalEl ) terminalEl.textContent = `▶ Running ${ lang } code…`;
                if ( runnerLabel ) runnerLabel.textContent = '· running…';

                try {
                    const resp = await fetch( '/api/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify( { language: lang, code, filename: `solution.${ lang }` } ),
                    } );
                    const data = await resp.json();
                    const exitInfo = data.exitCode != null ? `\n[exit code: ${ data.exitCode }]` : '';
                    const out = data.error
                        ? `[error] ${ data.error }`
                        : ( data.output || '(no output)' ) + exitInfo;
                    setOutput( out );
                    if ( runnerLabel ) runnerLabel.textContent = '· run by you';
                } catch ( err ) {
                    const out = `[error] Could not reach compiler: ${ err.message }`;
                    setOutput( out );
                    if ( runnerLabel ) runnerLabel.textContent = '· run failed';
                } finally {
                    if ( runBtn ) { runBtn.disabled = false; runBtn.textContent = '▶ Run'; }
                }
            },
        } );
        window.peerStudioUi = studioUi;

        codeCollab = initCodeCollab( socket, room, username, () => socketId );
        if ( codeCollab ) {
            registerCodeCollab( codeCollab );
            codeCollab.show();
            log( 'code', 'collab editor ready' );
        } else {
            warn( 'code', 'collab editor not initialized (missing DOM or CodeMirror)' );
        }

        var socketId = '';
        var randomNumber = `__${h.generateRandomString()}__${h.generateRandomString()}__`;
        var myStream = '';
        const peerNames = {};
        window.__remoteStreams = remoteStreams;
        window.__peerNames = peerNames;
        var screen = '';
        var recordedStream = [];
        var mediaRecorder = null;
        var recordingTimer = null;
        var recordingSeconds = 0;
        var pendingRecordingResolve = null;
        var savedRecordingFile = null;
        var isEndingCall = false;

        function formatRecordingTime( seconds ) {
            const mins = String( Math.floor( seconds / 60 ) ).padStart( 2, '0' );
            const secs = String( seconds % 60 ).padStart( 2, '0' );
            return `${ mins }:${ secs }`;
        }

        // ── Toast system ───────────────────────────────────────────────────────
        function showToast( html, duration = 4500 ) {
            const container = document.getElementById( 'toast-container' );
            if ( !container ) return;
            const toast = document.createElement( 'div' );
            toast.className = 'toast-item';
            toast.innerHTML = html;
            container.appendChild( toast );
            requestAnimationFrame( () => {
                requestAnimationFrame( () => toast.classList.add( 'toast-item--visible' ) );
            } );
            setTimeout( () => {
                toast.classList.remove( 'toast-item--visible' );
                setTimeout( () => toast.remove(), 320 );
            }, duration );
        }

        // ── Recording indicator (compact pill in header) ───────────────────────
        function updateRecIndicator( visible, seconds ) {
            const el = document.getElementById( 'rec-indicator' );
            const timerEl = document.getElementById( 'rec-timer' );
            if ( !el ) return;
            el.hidden = !visible;
            if ( timerEl && seconds !== undefined ) {
                timerEl.textContent = formatRecordingTime( seconds );
            }
        }

        function startRecordingTimer() {
            recordingSeconds = 0;
            updateRecIndicator( true, 0 );
            showToast(
                `<span class="toast-rec-dot"></span><div><strong>Recording Started</strong><small>Your session is being recorded locally</small></div>`,
                4000
            );
            recordingTimer = setInterval( () => {
                recordingSeconds += 1;
                updateRecIndicator( true, recordingSeconds );
            }, 1000 );
        }

        function stopRecordingTimer() {
            if ( recordingTimer ) {
                clearInterval( recordingTimer );
                recordingTimer = null;
            }
            updateRecIndicator( false );
        }

        // ── Recording saved modal ──────────────────────────────────────────────
        // isLeaving=true  → Keep/Delete/Cancel all navigate home after acting
        // isLeaving=false → Cancel/Keep just close the modal (stay in call)
        function showRecordingSavedModal( file, isLeaving ) {
            const modal = document.getElementById( 'recording-saved-modal' );
            if ( !modal ) {
                if ( isLeaving ) window.location.href = '/';
                return;
            }
            modal.removeAttribute( 'hidden' );

            // Backdrop click does nothing — only buttons close the modal
            const onBackdropClick = ( e ) => { if ( e.target === modal ) e.stopPropagation(); };
            modal.addEventListener( 'click', onBackdropClick );

            const closeModal = () => {
                modal.setAttribute( 'hidden', '' );
                modal.removeEventListener( 'click', onBackdropClick );
            };

            // Rebind a button with a fresh clone (prevents duplicate listeners)
            const rebind = ( id, handler ) => {
                const el = document.getElementById( id );
                if ( !el ) return;
                const clone = el.cloneNode( true );
                el.parentNode.replaceChild( clone, el );
                clone.addEventListener( 'click', handler );
            };

            // Download Recording
            rebind( 'rec-download-btn', () => {
                h.downloadRecording( file );
                showToast( `<span class="toast-ok-dot"></span><div><strong>Download started</strong><small>Recording downloaded successfully.</small></div>` );
                if ( isLeaving ) {
                    closeModal();
                    setTimeout( () => { window.location.href = '/'; }, 1500 );
                }
            } );

            // Keep for Later — persist in browser IndexedDB (survives refresh)
            rebind( 'rec-keep-btn', async () => {
                try {
                    const storeId = await saveRecordingToStore( file, { username } );
                    file.storeId = storeId;
                    savedRecordingFile = file;
                    closeModal();
                    if ( isLeaving ) {
                        window.location.href = '/';
                    } else {
                        showToast(
                            `<span class="toast-ok-dot"></span><div><strong>Recording kept in this browser</strong><small>Use Download when ready. A new Record will create a separate file.</small></div>`,
                            6000
                        );
                    }
                } catch ( err ) {
                    console.error( 'recording store failed', err );
                    closeModal();
                    showToast(
                        `<span class="toast-info-dot"></span><div><strong>Kept for this session only</strong><small>Download before you close the tab.</small></div>`,
                        5000
                    );
                    if ( isLeaving ) window.location.href = '/';
                }
            } );

            // Delete Recording
            rebind( 'rec-delete-btn', async () => {
                h.revokeRecordingUrl( file );
                if ( file.storeId != null ) {
                    try {
                        await deleteRecordingFromStore( file.storeId );
                    } catch ( err ) {
                        console.error( 'recording delete from store failed', err );
                    }
                }
                savedRecordingFile = null;
                closeModal();
                showToast( `<span class="toast-info-dot"></span><div>Recording deleted.</div>`, 3000 );
                if ( isLeaving ) window.location.href = '/';
            } );

            // Cancel — always just closes the modal; if leaving, this cancels the leave
            rebind( 'rec-cancel-btn', () => {
                closeModal();
                // If we stopped recording to leave but user cancels, reset the leave flag
                if ( isLeaving ) isEndingCall = false;
            } );
        }

        document.getElementById( 'enable-camera-btn' )?.addEventListener( 'click', ( e ) => {
            e.preventDefault();
            e.stopPropagation();
            trace( 'media', 'enable-camera-btn click' );
            getAndSetUserStream();
        } );

        document.getElementById( 'studio-pip' )?.addEventListener( 'click', ( e ) => {
            if ( e.target.closest( '#enable-camera-btn' ) ) return;
            if ( !myStream || !myStream.getVideoTracks().length ) {
                trace( 'media', 'studio-pip click → request camera' );
                getAndSetUserStream();
            }
        } );

        h.updatePipOverlay( {
            message: 'Allow camera when your browser asks',
            showButton: true,
        } );

        //Get user video for the call (recording starts only when Record is clicked)
        getAndSetUserStream();

        async function notifyStoredRecordings() {
            try {
                const n = await countRecordings();
                if ( !n ) return;
                const latest = await getLatestRecording();
                if ( !latest ) return;

                showToast(
                    `<span class="toast-info-dot"></span><div><strong>${ n } saved recording${ n > 1 ? 's' : '' } in this browser</strong>` +
                    `<small>Latest: ${ latest.filename }. Press Record to capture a new one.</small>` +
                    `<button type="button" class="toast-rec-dl">Download latest</button></div>`,
                    10000
                );

                const container = document.getElementById( 'toast-container' );
                const btn = container?.querySelector( '.toast-rec-dl' );
                if ( btn ) {
                    btn.addEventListener( 'click', () => {
                        h.downloadRecording( latest );
                        showToast( `<span class="toast-ok-dot"></span><div><strong>Download started</strong></div>`, 3000 );
                    }, { once: true } );
                }
            } catch ( err ) {
                console.warn( 'could not read stored recordings', err );
            }
        }

        notifyStoredRecordings();


        // Per-partner mute preference (survives modal open/close)
        const partnerMuted = {};

        // Always-on hidden audio element — ensures remote audio plays even when
        // the partner video modal is closed.
        function upsertRemoteAudio( partnerId, stream ) {
            let el = document.getElementById( `remote-audio-${ partnerId }` );
            if ( !el ) {
                el = document.createElement( 'audio' );
                el.id = `remote-audio-${ partnerId }`;
                el.autoplay = true;
                el.setAttribute( 'playsinline', '' );
                Object.assign( el.style, { position: 'absolute', width: '0', height: '0', visibility: 'hidden' } );
                document.body.appendChild( el );
            }
            el.srcObject = stream;
            el.muted = partnerMuted[partnerId] || false;
            el.play().catch( () => {} );
        }

        function removeRemoteAudio( partnerId ) {
            const el = document.getElementById( `remote-audio-${ partnerId }` );
            if ( el ) { el.srcObject = null; el.remove(); }
        }

        function attachRemoteVideo( partnerId, stream ) {
            trace( 'media', 'attachRemoteVideo', {
                partnerId,
                tracks: stream?.getTracks?.().map( ( t ) => `${ t.kind }:${ t.readyState }` ),
            } );
            remoteStreams[partnerId] = stream;

            // Start always-on audio immediately so partner is heard right away
            upsertRemoteAudio( partnerId, stream );

            studioUi?.updateParticipantCount();
            setTroubleshoot( 'Partner connected — click their name in People to view video.' );

            // If modal is already open for this partner, update the stream
            const modal = document.getElementById( 'partner-video-modal' );
            if ( modal && !modal.hidden && modal.dataset.partnerId === partnerId ) {
                const vid = document.getElementById( 'partner-modal-video' );
                if ( vid ) { vid.srcObject = stream; vid.play?.().catch( () => {} ); }
            }
        }

        // ── Partner video modal ────────────────────────────────────────────────
        window.openPartnerVideo = function ( partnerId ) {
            const stream = remoteStreams[partnerId];
            const modal = document.getElementById( 'partner-video-modal' );
            if ( !modal ) return;

            const vid = document.getElementById( 'partner-modal-video' );
            const nameEl = document.getElementById( 'partner-modal-name' );
            const muteBtn = document.getElementById( 'partner-modal-mute' );
            const hideBtn = document.getElementById( 'partner-modal-hide-video' );
            const fsBtn = document.getElementById( 'partner-modal-fullscreen' );
            const closeBtn = document.getElementById( 'partner-modal-close' );
            const backdrop = document.getElementById( 'partner-modal-backdrop' );
            const noVideo = document.getElementById( 'partner-modal-no-video' );
            const hiddenAudio = document.getElementById( `remote-audio-${ partnerId }` );

            modal.dataset.partnerId = partnerId;
            if ( nameEl ) nameEl.textContent = peerNames[partnerId] || 'Partner';

            // Modal video takes over audio — mute the always-on hidden audio element
            if ( hiddenAudio ) hiddenAudio.muted = true;

            if ( vid ) {
                // Force srcObject refresh so the video element picks up any track changes
                vid.srcObject = null;
                vid.srcObject = stream || null;
                vid.muted = partnerMuted[partnerId] || false;
                vid.hidden = false;
                if ( noVideo ) noVideo.hidden = true;

                // play() — retry once after a tick if it fails (e.g. track not yet live)
                const tryPlay = () => vid.play?.().catch( () => {
                    setTimeout( () => vid.play?.().catch( () => {} ), 300 );
                } );
                tryPlay();

                // If the video track is muted/blank right now (partner had camera off),
                // listen for it to come alive and force a srcObject refresh.
                const vTrack = stream?.getVideoTracks?.()[0];
                if ( vTrack ) {
                    const onUnmute = () => {
                        if ( modal.dataset.partnerId !== partnerId ) return;
                        vid.srcObject = null;
                        vid.srcObject = stream;
                        tryPlay();
                    };
                    vTrack.addEventListener( 'unmute', onUnmute, { once: true } );
                }
            }

            // Sync mute button label with current state
            const syncMuteLabel = () => {
                const icon = muteBtn?.querySelector( 'i' );
                const label = muteBtn?.querySelector( 'span' );
                const isMuted = partnerMuted[partnerId] || false;
                if ( icon ) icon.className = isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
                if ( label ) label.textContent = isMuted ? 'Unmute' : 'Mute';
            };
            syncMuteLabel();

            modal.removeAttribute( 'hidden' );

            // Clone buttons to remove any stale listeners from previous opens
            const rebindBtn = ( btn, handler ) => {
                if ( !btn ) return;
                const clone = btn.cloneNode( true );
                btn.parentNode.replaceChild( clone, btn );
                clone.addEventListener( 'click', handler );
                return clone;
            };

            rebindBtn( muteBtn, () => {
                partnerMuted[partnerId] = !( partnerMuted[partnerId] || false );
                if ( vid ) vid.muted = partnerMuted[partnerId];
                // Keep hidden audio in sync so unmuting after modal close works
                if ( hiddenAudio ) hiddenAudio.muted = true; // still muted while modal is open
                syncMuteLabel.call( document.getElementById( `partner-modal-mute` ) );
            } );

            rebindBtn( hideBtn, () => {
                if ( !vid || !noVideo ) return;
                const hiding = !vid.hidden;
                vid.hidden = hiding;
                noVideo.hidden = !hiding;
                const clone = document.getElementById( 'partner-modal-hide-video' );
                const icon = clone?.querySelector( 'i' );
                const label = clone?.querySelector( 'span' );
                if ( icon ) icon.className = hiding ? 'fas fa-video-slash' : 'fas fa-video';
                if ( label ) label.textContent = hiding ? 'Show video' : 'Hide video';
            } );

            rebindBtn( fsBtn, () => {
                const wrap = document.getElementById( 'partner-modal-video-wrap' );
                ( wrap || vid )?.requestFullscreen?.()?.catch( () => {} );
            } );

            function closeModal() {
                modal.setAttribute( 'hidden', '' );
                if ( vid ) { vid.srcObject = null; }
                // Hand audio back to the always-on hidden element
                const ha = document.getElementById( `remote-audio-${ partnerId }` );
                if ( ha ) {
                    ha.muted = partnerMuted[partnerId] || false;
                    ha.play?.().catch( () => {} );
                }
            }

            const freshClose = document.getElementById( 'partner-modal-close' );
            const freshBackdrop = document.getElementById( 'partner-modal-backdrop' );
            freshClose?.addEventListener( 'click', closeModal, { once: true } );
            freshBackdrop?.addEventListener( 'click', closeModal, { once: true } );
        };

        function removePartner( partnerId ) {
            trace( 'rtc', 'removePartner', { partnerId } );
            callManager?.destroyPeer( partnerId );
            delete remoteStreams[partnerId];
            delete partnerMuted[partnerId];

            // Stop and remove the always-on audio element for this partner
            removeRemoteAudio( partnerId );

            studioUi?.updateParticipantCount();
            studioUi?.logActivity( 'A participant left the session' );

            // Close partner video modal if it was showing this partner
            const modal = document.getElementById( 'partner-video-modal' );
            if ( modal && modal.dataset.partnerId === partnerId ) {
                modal.setAttribute( 'hidden', '' );
                const vid = document.getElementById( 'partner-modal-video' );
                if ( vid ) vid.srcObject = null;
            }
        }

        function cleanupAllRemotePeers() {
            trace( 'rtc', 'cleanupAllRemotePeers' );
            callManager?.destroyAll();
            document.querySelectorAll( '#videos .card.card-sm' ).forEach( ( el ) => el.remove() );
            h.adjustVideoElemSize();
        }

        function getOutboundStream() {
            if ( screen && screen.getVideoTracks().length && screen.getVideoTracks()[0].readyState === 'live' ) {
                return screen;
            }
            return myStream;
        }

        function initCallManager() {
            if ( callManager ) return callManager;

            trace( 'webrtc', 'initCallManager' );
            callManager = createCallManager( {
                socket,
                getSocketId: () => socketId,
                getLocalStream: getOutboundStream,
                getIceConfig: () => h.getIceServer(),
                onRemoteStream: attachRemoteVideo,
                onPeerLeft: removePartner,
                onPeerConnected: () => {
                    const status = document.getElementById( 'studio-connection-status' );
                    if ( status ) status.textContent = 'Connected';
                    setTroubleshoot( 'Video call connected.' );
                },
            } );

            callManager.bindSocketHandlers();
            return callManager;
        }


        function tryConnectAllPeers() {
            trace( 'webrtc', 'tryConnectAllPeers:start', {
                socketId: socketId || null,
                knownPeers: [ ...knownPeers ],
                hasLocalStream: !!getOutboundStream(),
            } );
            if ( !socketId ) {
                setTroubleshoot( 'Waiting for server connection…' );
                return;
            }

            if ( !getOutboundStream() ) {
                setTroubleshoot( 'Allow camera & microphone when prompted — required for video.' );
                return;
            }

            if ( !callManager ) initCallManager();

            const peerList = [ ...knownPeers ];
            trace( 'webrtc', 'tryConnectAllPeers:connecting', { peerList, socketId } );

            if ( !peerList.length ) {
                setTroubleshoot( 'You are in the room. Share this URL with your partner (same ?room= link).' );
            } else {
                setTroubleshoot( `Connecting video to ${ peerList.length } participant(s)…` );
            }

            callManager.syncKnownPeers( peerList );
        }

        initCallManager();

        socket.on( 'connect', () => {
            trace( 'socket', 'connect' );
            cleanupAllRemotePeers();
            knownPeers.clear();
            socketId = socket.id;
            const engineId = socket.io?.engine?.id;

            if ( engineId && engineId !== socketId ) {
                warn( 'socket', 'socket.id !== engine.id', { socketId, engineId } );
            }

            log( 'socket', 'connected', { socketId, room, transport: socket.io?.engine?.transport?.name } );

            const randomNumberEl = document.getElementById( 'randomNumber' );
            if ( randomNumberEl ) randomNumberEl.innerText = randomNumber;

            const status = document.getElementById( 'studio-connection-status' );
            if ( status ) status.textContent = 'Socket connected';

            setTroubleshoot( 'Joined signaling server. Allow camera if asked.' );

            trace( 'socket', 'emit subscribe', { room, socketId } );
            socket.emit( 'subscribe', {
                room: room,
                socketId: socketId,
            } );

            socket.emit( 'user-announce', { room, username } );

            tryConnectAllPeers();
        } );

        socket.on( 'new user', ( data ) => {
            trace( 'socket', 'new user', data );
            if ( !data.socketId || data.socketId === socketId ) return;
            knownPeers.add( data.socketId );
            initCallManager();
            tryConnectAllPeers();
            studioUi?.logActivity( 'A participant joined the call' );
            // ask them to announce their name
            socket.emit( 'user-announce', { room, username } );
        } );

        socket.on( 'user-announce', ( data ) => {
            if ( !data?.socketId || !data?.username ) return;
            trace( 'socket', 'user-announce', data );
            peerNames[data.socketId] = data.username;

            // update video tile label if already rendered
            const tile = document.getElementById( data.socketId );
            if ( tile ) {
                tile.dataset.displayName = data.username;
                const label = tile.querySelector( '.remote-name-label' );
                if ( label ) label.textContent = data.username;
            }

            studioUi?.updateParticipantCount();
        } );

        socket.on( 'user left', ( data ) => {
            trace( 'socket', 'user left', data );
            if ( data.socketId ) {
                knownPeers.delete( data.socketId );
                removePartner( data.socketId );
            }
            tryConnectAllPeers();
        } );


        socket.on( 'chat', ( data ) => {
            trace( 'chat', 'recv', { sender: data?.sender, len: data?.msg?.length } );
            h.addChat( data, 'remote' );
        } );

        socket.on( 'terminal:output', ( data ) => {
            const terminalEl = document.getElementById( 'studio-terminal-output' );
            if ( terminalEl && data?.output !== undefined ) {
                terminalEl.textContent = data.output;
                const runnerLabel = document.getElementById( 'terminal-runner-label' );
                if ( runnerLabel ) runnerLabel.textContent = data.sender ? `· run by ${ data.sender }` : '';
            }
        } );


        function updateMicButton( enabled ) {
            const btn = document.getElementById( 'toggle-mute' );
            if ( !btn ) return;

            const icon = btn.querySelector( 'i' );
            const label = btn.querySelector( '.mic-label' );

            btn.classList.toggle( 'studio-icon-btn--off', !enabled );
            btn.classList.toggle( 'call-toolbar__btn--muted', !enabled );
            btn.setAttribute( 'title', enabled ? 'Mute microphone' : 'Unmute microphone' );

            if ( icon ) {
                icon.classList.toggle( 'fa-microphone', enabled );
                icon.classList.toggle( 'fa-microphone-slash', !enabled );
            }

            if ( label ) label.textContent = enabled ? 'Mute' : 'Unmute';
        }


        function updateVideoButton( enabled ) {
            const btn = document.getElementById( 'toggle-video' );
            if ( !btn ) return;

            const icon = btn.querySelector( 'i' );
            const label = btn.querySelector( '.video-label' );

            btn.classList.toggle( 'studio-icon-btn--off', !enabled );
            btn.classList.toggle( 'call-toolbar__btn--off', !enabled );
            btn.setAttribute( 'title', enabled ? 'Turn camera off' : 'Turn camera on' );

            if ( icon ) {
                icon.classList.toggle( 'fa-video', enabled );
                icon.classList.toggle( 'fa-video-slash', !enabled );
            }

            if ( label ) label.textContent = enabled ? 'Video' : 'Camera off';

            // Sync the pip tile label and camera-off state
            const pip = document.getElementById( 'studio-pip' );
            const pipLabel = document.getElementById( 'studio-pip-label' );
            if ( enabled ) {
                pip?.classList.remove( 'studio-pip--camera-off' );
                if ( pipLabel ) pipLabel.textContent = 'You';
            } else {
                pip?.classList.add( 'studio-pip--camera-off' );
                if ( pipLabel ) pipLabel.textContent = 'Camera off';
            }
        }


        async function toggleLocalMic() {
            trace( 'media', 'toggleLocalMic' );
            const track = myStream && myStream.getAudioTracks()[0];

            if ( !track ) {
                const dlg = await getCmDialog();
                await dlg.alert( {
                    title: 'Microphone required',
                    message: 'Allow microphone access to mute your audio.',
                    variant: 'warning',
                } );
                return;
            }

            track.enabled = !track.enabled;
            updateMicButton( track.enabled );
            broadcastNewTracks( myStream, 'audio' );
        }


        async function toggleLocalVideo() {
            trace( 'media', 'toggleLocalVideo' );

            if ( !myStream ) {
                const dlgCam = await getCmDialog();
                await dlgCam.alert( {
                    title: 'Camera required',
                    message: 'Allow camera access to control video.',
                    variant: 'warning',
                } );
                return;
            }

            const track = myStream.getVideoTracks()[0];
            const cameraIsLive = track && track.readyState === 'live';

            if ( cameraIsLive ) {
                // ── Turn camera OFF ────────────────────────────────────────────
                // stop() releases the hardware → green indicator goes off
                track.stop();
                myStream.removeTrack( track );

                // Send nothing to peers (black / no video)
                callManager?.replaceVideoTrack( null );

                // Clear local preview
                const localVid = document.getElementById( 'local' );
                if ( localVid ) localVid.srcObject = null;

                updateVideoButton( false );
                h.updatePipOverlay( { message: 'Camera off' } );

            } else {
                // ── Turn camera ON ─────────────────────────────────────────────
                try {
                    const newStream = await navigator.mediaDevices.getUserMedia( { video: true } );
                    const newTrack = newStream.getVideoTracks()[0];

                    // Graft the new video track onto the existing stream object
                    myStream.addTrack( newTrack );

                    // Push new track to every live peer connection
                    callManager?.replaceVideoTrack( newTrack );

                    // Update local preview
                    const lv = document.getElementById( 'local' );
                    if ( lv ) lv.srcObject = null; // force srcObject refresh
                    h.setLocalStream( myStream, true );

                    updateVideoButton( true );
                    h.updatePipOverlay( { message: null } );
                } catch ( err ) {
                    error( 'media', 'toggleLocalVideo:restart-failed', { name: err?.name, message: err?.message } );
                    h.updatePipOverlay( {
                        message: `Camera blocked — allow access in browser settings`,
                        showButton: false,
                    } );
                }
            }
        }


        function getAndSetUserStream() {
            const status = document.getElementById( 'studio-connection-status' );

            if ( myStream ) {
                h.stopMediaStream( myStream );
                myStream = '';
            }

            trace( 'media', 'getAndSetUserStream:start', {
                secureContext: window.isSecureContext,
                href: location.href,
            } );

            h.getUserFullMedia().then( ( stream ) => {
                trace( 'media', 'getAndSetUserStream:success', {
                    video: stream.getVideoTracks().map( ( t ) => `${ t.label }:${ t.readyState }` ),
                    audio: stream.getAudioTracks().map( ( t ) => `${ t.label }:${ t.readyState }` ),
                } );
                myStream = stream;
                h.setLocalStream( stream );
                updateMicButton( stream.getAudioTracks()[0]?.enabled !== false );
                updateVideoButton( stream.getVideoTracks()[0]?.enabled !== false );

                if ( status ) status.textContent = 'Camera on';

                if ( !stream.getVideoTracks().length ) {
                    setTroubleshoot( 'Only microphone allowed — click Enable camera on the You tile or allow camera in browser settings.' );
                }

                initCallManager();
                tryConnectAllPeers();
            } ).catch( ( e ) => {
                error( 'media', 'getUserMedia failed', {
                    name: e?.name,
                    code: e?.code,
                    message: e?.message || String( e ),
                    secureContext: window.isSecureContext,
                } );
                if ( status ) status.textContent = 'Allow camera & mic';

                if ( e?.code === 'SECURE_CONTEXT_REQUIRED' || !window.isSecureContext ) {
                    h.updatePipOverlay( {
                        message: 'Use https:// or localhost — not http:// IP',
                        showButton: false,
                    } );
                    setTroubleshoot(
                        'Phone app permissions are ON, but the browser still needs HTTPS for camera. Use https://your-domain or test on desktop localhost:8000.'
                    );
                    return;
                }

                h.updatePipOverlay( {
                    message: `Tap Enable camera (${ e?.name || 'error' })`,
                    showButton: true,
                } );
                setTroubleshoot(
                    `OS permission can be ON while this website is still blocked. In Chrome: address bar → site settings → Camera → Allow. Then tap Enable camera on the You tile. (${ e?.name || e })`
                );
            } );
        }

        function toggleRecordingIcons( isRecording ) {
            const btn = document.getElementById( 'record' );
            if ( !btn ) return;

            const icon = btn.querySelector( '.record-icon' );
            const label = btn.querySelector( '.record-label' );

            if ( isRecording ) {
                btn.setAttribute( 'title', 'Stop recording' );
                btn.classList.add( 'is-recording' );
                if ( icon ) {
                    icon.classList.add( 'text-danger' );
                    icon.classList.remove( 'text-white' );
                }
                if ( label ) label.textContent = 'Stop';
            } else {
                btn.setAttribute( 'title', 'Start recording' );
                btn.classList.remove( 'is-recording' );
                if ( icon ) {
                    icon.classList.add( 'text-white' );
                    icon.classList.remove( 'text-danger' );
                }
                if ( label ) label.textContent = 'Record';
            }
        }

        async function startCallRecording( stream ) {
            if ( mediaRecorder && mediaRecorder.state === 'recording' ) return;

            const mimeType = h.getRecordingMimeType();
            const options = mimeType ? { mimeType } : undefined;

            try {
                mediaRecorder = new MediaRecorder( stream, options );
            } catch ( err ) {
                console.error( 'Local recording not supported:', err );
                const dlgRec = await getCmDialog();
                await dlgRec.alert( {
                    title: 'Recording unavailable',
                    message: 'Recording is not supported in this browser.',
                    variant: 'warning',
                } );
                return;
            }

            recordedStream = [];

            mediaRecorder.ondataavailable = function ( e ) {
                if ( e.data && e.data.size > 0 ) {
                    recordedStream.push( e.data );
                }
            };

            mediaRecorder.onstop = function () {
                stopRecordingTimer();
                toggleRecordingIcons( false );

                if ( recordedStream.length ) {
                    if ( savedRecordingFile ) {
                        h.revokeRecordingUrl( savedRecordingFile );
                    }
                    savedRecordingFile = h.createRecordingFile(
                        recordedStream,
                        `${ username }-call`
                    );
                }

                if ( pendingRecordingResolve ) {
                    pendingRecordingResolve( savedRecordingFile );
                    pendingRecordingResolve = null;
                } else if ( savedRecordingFile && !isEndingCall ) {
                    // Mid-call stop — show "Recording Saved" modal without leaving
                    showRecordingSavedModal( savedRecordingFile, false );
                }

                recordedStream = [];
            };

            mediaRecorder.onerror = function ( e ) {
                console.error( e );
                stopRecordingTimer();
                toggleRecordingIcons( false );
            };

            mediaRecorder.start( 1000 );
            toggleRecordingIcons( true );
            startRecordingTimer();
        }

        async function handleRecordClick() {
            if ( mediaRecorder && mediaRecorder.state === 'recording' ) {
                mediaRecorder.stop();
                return;
            }

            if ( savedRecordingFile ) {
                const dlg = await getCmDialog();
                const replace = await dlg.confirm( {
                    title: 'Start new recording?',
                    message:
                        'You already have a recording from this session (not downloaded yet).\n\n' +
                        'Start a new recording? Stopping the new capture will replace that session recording. ' +
                        'Recordings you chose "Keep for Later" stay saved in this browser.',
                    confirmLabel: 'Start new recording',
                    cancelLabel: 'Cancel',
                    variant: 'warning',
                } );
                if ( !replace ) return;
                if ( !savedRecordingFile.storeId ) {
                    h.revokeRecordingUrl( savedRecordingFile );
                }
                savedRecordingFile = null;
            }

            if ( !myStream ) {
                try {
                    myStream = await h.getUserFullMedia();
                    h.setLocalStream( myStream );
                } catch ( err ) {
                    const dlgMedia = await getCmDialog();
                    await dlgMedia.alert( {
                        title: 'Camera & microphone required',
                        message: 'Allow camera and microphone to record the call.',
                        variant: 'warning',
                    } );
                    return;
                }
            }

            startCallRecording( myStream );
        }

        function stopCallRecording() {
            return new Promise( ( resolve ) => {
                if ( !mediaRecorder || mediaRecorder.state === 'inactive' ) {
                    resolve( savedRecordingFile );
                    return;
                }

                pendingRecordingResolve = resolve;
                mediaRecorder.stop();
            } );
        }

        function cleanupMedia() {
            trace( 'rtc', 'cleanupMedia' );
            callManager?.destroyAll();
            if ( myStream ) {
                myStream.getTracks().forEach( ( track ) => track.stop() );
            }
            if ( screen ) {
                screen.getTracks().forEach( ( track ) => track.stop() );
            }
            const local = document.getElementById( 'local' );
            if ( local ) local.srcObject = null;
            socket.disconnect();
        }

        async function handleLeaveCall() {
            trace( 'rtc', 'handleLeaveCall' );
            if ( isEndingCall ) return;
            isEndingCall = true;

            // If actively recording, stop it first then show the Recording Saved modal
            if ( mediaRecorder && mediaRecorder.state === 'recording' ) {
                showToast( `<span class="toast-info-dot"></span><div>Saving recording…</div>`, 3000 );
                const file = await stopCallRecording();
                cleanupMedia();
                if ( file ) {
                    showRecordingSavedModal( file, true );
                } else {
                    window.location.href = '/';
                }
                return;
            }

            cleanupMedia();

            if ( savedRecordingFile ) {
                showRecordingSavedModal( savedRecordingFile, true );
            } else {
                window.location.href = '/';
            }
        }

        document.getElementById( 'leave-call' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();
            handleLeaveCall();
        } );

        window.addEventListener( 'beforeunload', ( e ) => {
            if ( mediaRecorder && mediaRecorder.state === 'recording' && !isEndingCall ) {
                e.preventDefault();
                e.returnValue = 'Recording is still in progress. Stop recording before leaving?';
            }
        } );


        function sendMsg( msg ) {
            let data = {
                room: room,
                msg: msg,
                sender: `${username} (${randomNumber})`
            };

            trace( 'chat', 'emit', { room, len: msg?.length } );
            socket.emit( 'chat', data );

            //add localchat
            h.addChat( data, 'local' );
        }



        function shareScreen() {
            trace( 'media', 'shareScreen:start' );
            h.shareScreen().then( ( stream ) => {
                trace( 'media', 'shareScreen:ok' );
                h.toggleShareIcons( true );

                // Disable video toggle while sharing screen
                h.toggleVideoBtnDisabled( true );

                // Save screen stream and update local preview.
                // Null out srcObject first so setLocalStream doesn't call
                // stopMediaStream() on myStream (the camera) — that would kill it.
                screen = stream;
                const localVid = document.getElementById( 'local' );
                if ( localVid ) localVid.srcObject = null;
                h.setLocalStream( stream, false );

                // Swap only the video track on every live peer connection —
                // no renegotiation, no disconnects
                const screenTrack = stream.getVideoTracks()[0];
                callManager?.replaceVideoTrack( screenTrack );

                // When user clicks browser's native "Stop sharing" button
                screenTrack.addEventListener( 'ended', () => {
                    stopSharingScreen();
                } );
            } ).catch( ( e ) => {
                console.error( e );
            } );
        }



        function stopSharingScreen() {
            trace( 'media', 'stopSharingScreen' );
            h.toggleVideoBtnDisabled( false );

            // Stop all screen tracks
            if ( screen ) screen.getTracks().forEach( ( track ) => track.stop() );

            h.toggleShareIcons( false );
            screen = '';

            // Null out srcObject first so setLocalStream doesn't try to
            // stop the (already-stopped) screen stream a second time.
            const localVidStop = document.getElementById( 'local' );
            if ( localVidStop ) localVidStop.srcObject = null;

            // Restore local camera preview
            h.setLocalStream( myStream, true );

            // Swap back to camera track on every live peer — no disconnects
            const cameraTrack = myStream?.getVideoTracks()[0] || null;
            callManager?.replaceVideoTrack( cameraTrack );
        }



        function broadcastNewTracks( stream, type, mirrorMode = true ) {
            h.setLocalStream( stream, mirrorMode );
            // Track enable/disable is reflected automatically for audio.
            // For video: if not screen sharing, push the new camera track to peers.
            if ( type === 'video' && !screen ) {
                const videoTrack = stream.getVideoTracks()[0] || null;
                callManager?.replaceVideoTrack( videoTrack );
            }
        }

        document.getElementById('chat-input-btn').addEventListener('click',(e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            if ( input.value.trim() ) {
                sendMsg( input.value );
                input.value = '';
            }
        });

        //Chat textarea
        document.getElementById( 'chat-input' ).addEventListener( 'keypress', ( e ) => {
            if ( e.which === 13 && ( e.target.value.trim() ) ) {
                e.preventDefault();

                sendMsg( e.target.value );

                setTimeout( () => {
                    e.target.value = '';
                }, 50 );
            }
        } );


        //When the video icon is clicked
        document.getElementById( 'toggle-video' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();
            toggleLocalVideo();
        } );


        //When the mute icon is clicked
        document.getElementById( 'toggle-mute' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();
            toggleLocalMic();
        } );


        document.getElementById( 'videos' ).addEventListener( 'click', ( e ) => {
            const muteBtn = e.target.closest( '.mute-remote-mic' );
            if ( muteBtn ) {
                e.preventDefault();
                h.singleStreamToggleMute( { target: muteBtn } );
                return;
            }

            const expandBtn = e.target.closest( '.expand-remote-video' );
            if ( expandBtn ) {
                e.preventDefault();
                h.toggleRemoteVideoFocus( e );
            }

            const remoteVideo = e.target.closest( '#videos .card.card-sm video.remote-video' );
            if ( remoteVideo && e.detail === 2 ) {
                h.maximiseStream( { target: remoteVideo } );
            }
        } );


        //When user clicks the 'Share screen' button
        document.getElementById( 'share-screen' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();

            if ( screen && screen.getVideoTracks().length && screen.getVideoTracks()[0].readyState != 'ended' ) {
                stopSharingScreen();
            }

            else {
                shareScreen();
            }
        } );


        // Record button — start/stop local recording
        document.getElementById( 'record' ).addEventListener( 'click', ( e ) => {
            e.preventDefault();
            handleRecordClick();
        } );

        // Inline Stop button inside the rec-indicator pill
        document.getElementById( 'rec-stop-btn' )?.addEventListener( 'click', ( e ) => {
            e.preventDefault();
            if ( mediaRecorder && mediaRecorder.state === 'recording' ) {
                mediaRecorder.stop();
            }
        } );
    }
} );
