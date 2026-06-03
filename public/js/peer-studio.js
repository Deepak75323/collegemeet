/** Peer Studio UI chrome — tabs, timer, panel resize, activity, run terminal */

import debugLog from './debug-log.js';

const { trace } = debugLog;

export function initPeerStudio( options = {} ) {
    trace( 'studio', 'initPeerStudio', { room: options.room, username: options.username } );
    const { room, username, onRun } = options;

    const sessionEl = document.getElementById( 'studio-session' );
    const titleEl = document.getElementById( 'studio-session-title' );
    const timerEl = document.getElementById( 'studio-session-timer' );
    const peopleListEl = document.getElementById( 'studio-people-list' );
    const activityFeed = document.getElementById( 'studio-activity-feed' );
    const terminalOut = document.getElementById( 'studio-terminal-output' );

    let timerInterval = null;
    let sessionSeconds = 0;

    if ( titleEl && room ) {
        const short = room.length > 36 ? `${ room.slice( 0, 36 ) }…` : room;
        titleEl.textContent = short;
    }

    function logActivity( text ) {
        if ( !activityFeed ) return;
        const item = document.createElement( 'div' );
        item.className = 'studio-activity__item';
        item.innerHTML = `<span>${ moment().format( 'HH:mm' ) }</span><span>${ text }</span>`;
        activityFeed.prepend( item );
        while ( activityFeed.children.length > 40 ) {
            activityFeed.lastChild.remove();
        }
    }

    function switchTab( tabId ) {
        trace( 'studio', 'switchTab', { tabId } );
        document.querySelectorAll( '.studio-panel__tab' ).forEach( ( btn ) => {
            btn.classList.toggle( 'studio-panel__tab--active', btn.dataset.studioTab === tabId );
        } );
        document.querySelectorAll( '.studio-panel__pane' ).forEach( ( pane ) => {
            pane.classList.toggle( 'studio-panel__pane--active', pane.dataset.studioPane === tabId );
        } );
    }

    document.querySelectorAll( '.studio-panel__tab' ).forEach( ( btn ) => {
        btn.addEventListener( 'click', () => switchTab( btn.dataset.studioTab ) );
    } );

    document.getElementById( 'toggle-chat-pane' )?.addEventListener( 'click', () => {
        switchTab( 'chat' );
        document.getElementById( 'new-chat-notification' )?.setAttribute( 'hidden', true );
    } );

    function startTimer() {
        if ( timerInterval ) return;
        timerInterval = setInterval( () => {
            sessionSeconds += 1;
            const m = String( Math.floor( sessionSeconds / 60 ) ).padStart( 2, '0' );
            const s = String( sessionSeconds % 60 ).padStart( 2, '0' );
            if ( timerEl ) timerEl.textContent = `${ m }:${ s }`;
        }, 1000 );
    }

    function renderPeopleList() {
        if ( !peopleListEl ) return;

        const remoteStreams = window.__remoteStreams || {};
        const peerNames = window.__peerNames || {};
        const remoteCount = Object.keys( remoteStreams ).length;
        const total = remoteCount + 1;

        peopleListEl.innerHTML = `
            <div class="studio-people-list__item">
                <div class="studio-avatar">${ ( username || 'Y' ).charAt( 0 ).toUpperCase() }</div>
                <span><strong>${ username || 'You' }</strong> (you)</span>
            </div>
        `;

        Object.keys( remoteStreams ).forEach( ( partnerId ) => {
            const name = peerNames[partnerId] || 'Guest';
            const hasVideo = !!remoteStreams[partnerId];
            const item = document.createElement( 'div' );
            item.className = 'studio-people-list__item studio-people-list__item--clickable';
            item.title = hasVideo ? `Click to view ${ name }'s video` : `${ name } — no video yet`;
            item.innerHTML = `
                <div class="studio-avatar">${ name.charAt( 0 ).toUpperCase() }</div>
                <span>${ name }</span>
                ${ hasVideo ? '<i class="fas fa-video" style="margin-left:auto;font-size:0.7rem;color:var(--studio-success)"></i>' : '<i class="fas fa-video-slash" style="margin-left:auto;font-size:0.7rem;opacity:.4"></i>' }
            `;
            item.addEventListener( 'click', () => {
                if ( window.openPartnerVideo ) window.openPartnerVideo( partnerId );
            } );
            peopleListEl.appendChild( item );
        } );

        const hint = document.getElementById( 'studio-video-hint' );
        if ( hint ) {
            hint.hidden = remoteCount > 0;
        }

        const countEl = document.getElementById( 'studio-participant-count' );
        if ( countEl ) {
            countEl.textContent = `${ total } participant${ total === 1 ? '' : 's' }`;
        }
    }

    function updateParticipantCount() {
        renderPeopleList();
    }

    document.getElementById( 'run-code-btn' )?.addEventListener( 'click', () => {
        trace( 'studio', 'run-code click' );
        if ( onRun && terminalOut ) {
            onRun( terminalOut );
        }
    } );

    document.getElementById( 'clear-terminal-btn' )?.addEventListener( 'click', () => {
        if ( terminalOut ) terminalOut.textContent = '';
    } );

    const resizer = document.getElementById( 'panel-resizer' );
    const panel = document.getElementById( 'collab-panel' );

    if ( resizer && panel ) {
        let dragging = false;

        resizer.addEventListener( 'mousedown', () => {
            dragging = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } );

        window.addEventListener( 'mousemove', ( e ) => {
            if ( !dragging ) return;
            const w = window.innerWidth - e.clientX;
            panel.style.width = `${ Math.min( 480, Math.max( 280, w ) ) }px`;
        } );

        window.addEventListener( 'mouseup', () => {
            dragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        } );
    }

    if ( sessionEl ) {
        sessionEl.removeAttribute( 'hidden' );
        document.body.classList.add( 'studio-active' );
        startTimer();
        logActivity( `<strong>${ username || 'You' }</strong> joined the session` );
        renderPeopleList();
    }

    return {
        logActivity,
        switchTab,
        updateParticipantCount,
        refreshEditor: () => {},
    };
}

export function runJavaScriptInTerminal( code, terminalEl ) {
    if ( !terminalEl ) return;

    const logs = [];
    const sandboxConsole = {
        log: ( ...args ) => logs.push( args.map( String ).join( ' ' ) ),
        error: ( ...args ) => logs.push( `[error] ${ args.map( String ).join( ' ' ) }` ),
    };

    try {
        const fn = new Function( 'console', code );
        fn( sandboxConsole );
        terminalEl.textContent = logs.length ? logs.join( '\n' ) : '(no output)';
    } catch ( err ) {
        terminalEl.textContent = String( err );
    }
}
