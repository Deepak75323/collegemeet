/**
 * Server-side room / WebRTC flow logging.
 * Console: always (grep [stream] in terminal)
 * File: production_logs/room-flow.log when DEBUG_LOGS=1 (default on in development)
 */

const fs = require( 'fs' );
const path = require( 'path' );

const verboseJson = process.env.DEBUG_STREAM === '1' || process.env.DEBUG_STREAM === 'true';
const fileEnabled =
    process.env.DEBUG_LOGS === '1' ||
    process.env.DEBUG_LOGS === 'true' ||
    ( process.env.DEBUG_LOGS !== '0' && process.env.NODE_ENV !== 'production' );

const logDir = path.join( __dirname, '..', 'production_logs' );
const logFile = path.join( logDir, 'room-flow.log' );

function writeFile( line ) {
    if ( !fileEnabled ) return;

    try {
        if ( !fs.existsSync( logDir ) ) {
            fs.mkdirSync( logDir, { recursive: true } );
        }

        fs.appendFileSync( logFile, `${ line }\n` );
    } catch ( err ) {
        console.warn( '[stream] file log failed', err.message );
    }
}

function formatPayload( level, event, detail = {} ) {
    return {
        ts: new Date().toISOString(),
        level,
        event,
        ...detail,
    };
}

function emit( level, event, detail = {} ) {
    const payload = formatPayload( level, event, detail );
    const line = verboseJson ? JSON.stringify( payload ) : `${ payload.ts } [${ level }] ${ event } ${ JSON.stringify( detail ) }`;

    if ( level === 'error' ) {
        console.error( '[stream]', line );
    } else if ( level === 'warn' ) {
        console.warn( '[stream]', line );
    } else {
        console.log( '[stream]', line );
    }

    writeFile( line );
}

function trace( event, detail = {} ) {
    emit( 'trace', event, detail );
}

function log( event, detail = {} ) {
    emit( 'info', event, detail );
}

function warn( event, detail = {} ) {
    emit( 'warn', event, detail );
}

function error( event, detail = {} ) {
    emit( 'error', event, detail );
}

module.exports = {
    trace,
    log,
    warn,
    error,
    isFileEnabled: () => fileEnabled,
    logFilePath: logFile,
};
