/**
 * Collegemeet session logging — always writes to the browser console.
 * On-page panel: ?debug=1 or localStorage cm_debug=1
 * Export later: cmDumpLogs() / cmGetLogs() in DevTools console
 */

const MAX_HISTORY = 800;
const MAX_PANEL_LINES = 200;

const history = [];

let panelEnabled = false;
let panelEl = null;
let listEl = null;

function isPanelEnabled() {
    try {
        if ( localStorage.getItem( 'cm_debug' ) === '1' ) return true;
    } catch {
        /* ignore */
    }

    return /(?:^|[?&])debug=1(?:&|$)/.test( location.search );
}

function serialize( data ) {
    if ( data === undefined ) return undefined;

    try {
        return JSON.parse( JSON.stringify( data ) );
    } catch {
        return String( data );
    }
}

function record( level, module, message, data ) {
    history.push( {
        ts: new Date().toISOString(),
        level,
        module,
        message,
        data: serialize( data ),
    } );

    if ( history.length > MAX_HISTORY ) {
        history.shift();
    }
}

function emitConsole( level, module, message, data ) {
    const prefix = `[Collegemeet:${ module }]`;
    const payload = data !== undefined ? [ prefix, message, data ] : [ prefix, message ];

    switch ( level ) {
        case 'error':
            console.error( ...payload );
            break;
        case 'warn':
            console.warn( ...payload );
            break;
        case 'trace':
            console.log( ...payload );
            break;
        default:
            console.log( ...payload );
    }
}

function appendPanelLine( level, module, message, data ) {
    if ( !panelEnabled ) return;

    ensurePanel();

    const time = new Date().toLocaleTimeString();
    let line = `[${ time }] [${ level }] [${ module }] ${ message }`;

    if ( data !== undefined ) {
        try {
            line += ` ${ JSON.stringify( data ) }`;
        } catch {
            line += ' [unserializable]';
        }
    }

    if ( listEl ) {
        listEl.textContent += `${ line }\n`;
        const lines = listEl.textContent.split( '\n' );

        if ( lines.length > MAX_PANEL_LINES ) {
            listEl.textContent = lines.slice( -MAX_PANEL_LINES ).join( '\n' );
        }

        listEl.scrollTop = listEl.scrollHeight;
    }
}

function trace( module, step, data ) {
    record( 'trace', module, step, data );
    emitConsole( 'trace', module, step, data );
    appendPanelLine( 'trace', module, step, data );
}

function log( module, message, data ) {
    record( 'info', module, message, data );
    emitConsole( 'info', module, message, data );
    appendPanelLine( 'info', module, message, data );
}

function warn( module, message, data ) {
    record( 'warn', module, message, data );
    emitConsole( 'warn', module, message, data );
    appendPanelLine( 'warn', module, message, data );
}

function error( module, message, data ) {
    record( 'error', module, message, data );
    emitConsole( 'error', module, message, data );
    appendPanelLine( 'error', module, message, data );
}

function ensurePanel() {
    if ( panelEl || !panelEnabled ) return;

    panelEl = document.createElement( 'div' );
    panelEl.id = 'cm-debug-panel';
    panelEl.className = 'cm-debug-panel';
    panelEl.innerHTML = `
        <div class="cm-debug-panel__head">
            <strong>Debug log</strong>
            <span class="cm-debug-panel__hint">?debug=1 · cmDumpLogs()</span>
            <button type="button" class="cm-debug-panel__clear" id="cm-debug-clear">Clear</button>
            <button type="button" class="cm-debug-panel__close" id="cm-debug-close" aria-label="Hide">×</button>
        </div>
        <pre class="cm-debug-panel__body" id="cm-debug-list"></pre>
    `;

    document.body.appendChild( panelEl );
    listEl = document.getElementById( 'cm-debug-list' );

    document.getElementById( 'cm-debug-clear' )?.addEventListener( 'click', () => {
        if ( listEl ) listEl.textContent = '';
    } );

    document.getElementById( 'cm-debug-close' )?.addEventListener( 'click', () => {
        panelEl?.setAttribute( 'hidden', '' );
    } );
}

export function getLogHistory() {
    return [ ...history ];
}

export function dumpLogsToConsole() {
    console.log( '[Collegemeet] log dump', getLogHistory() );
    return getLogHistory();
}

export function initDebugLog() {
    panelEnabled = isPanelEnabled();

    window.cmGetLogs = getLogHistory;
    window.cmDumpLogs = dumpLogsToConsole;

    log( 'debug', 'logging active (console always; panel=' + panelEnabled + ')', {
        href: location.href,
        secureContext: typeof window !== 'undefined' ? window.isSecureContext : null,
    } );

    if ( panelEnabled ) {
        ensurePanel();
        const hint = document.getElementById( 'studio-debug-hint' );
        if ( hint ) hint.removeAttribute( 'hidden' );
    } else {
        console.info(
            '[Collegemeet] Console logging is on for every flow. Add ?debug=1 for the on-page panel, or run cmDumpLogs() to export.'
        );
    }

    window.addEventListener( 'error', ( ev ) => {
        error( 'window', ev.message || 'Script error', {
            filename: ev.filename,
            lineno: ev.lineno,
            colno: ev.colno,
        } );
    } );

    window.addEventListener( 'unhandledrejection', ( ev ) => {
        error( 'promise', ev.reason?.message || String( ev.reason ), ev.reason );
    } );

    return panelEnabled;
}

export function isDebugOn() {
    return panelEnabled;
}

export const debugLog = {
    trace,
    log,
    warn,
    error,
    getLogHistory,
    dumpLogsToConsole,
    isDebugOn,
};

export default debugLog;
