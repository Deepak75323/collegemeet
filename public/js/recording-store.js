/**
 * Persist "Keep for Later" recordings in the browser (IndexedDB).
 * Survives page refresh / rejoining a room — not the server disk.
 */

const DB_NAME = 'collegemeet-recordings-v1';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

function openDb() {
    return new Promise( ( resolve, reject ) => {
        if ( !window.indexedDB ) {
            reject( new Error( 'IndexedDB not supported' ) );
            return;
        }
        const req = indexedDB.open( DB_NAME, DB_VERSION );
        req.onerror = () => reject( req.error );
        req.onsuccess = () => resolve( req.result );
        req.onupgradeneeded = ( e ) => {
            const db = e.target.result;
            if ( !db.objectStoreNames.contains( STORE_NAME ) ) {
                db.createObjectStore( STORE_NAME, { keyPath: 'id', autoIncrement: true } );
            }
        };
    } );
}

function toRecordingFile( row ) {
    if ( !row || !row.blob ) return null;
    return {
        id: row.id,
        blob: row.blob,
        filename: row.filename,
        savedAt: row.savedAt,
        username: row.username,
        url: URL.createObjectURL( row.blob ),
    };
}

export async function saveRecordingToStore( recordingFile, meta = {} ) {
    const db = await openDb();
    return new Promise( ( resolve, reject ) => {
        const tx = db.transaction( STORE_NAME, 'readwrite' );
        const store = tx.objectStore( STORE_NAME );
        const req = store.add( {
            filename: recordingFile.filename,
            blob: recordingFile.blob,
            savedAt: Date.now(),
            username: meta.username || '',
        } );
        req.onsuccess = () => resolve( req.result );
        req.onerror = () => reject( req.error );
    } );
}

export async function getLatestRecording() {
    const db = await openDb();
    return new Promise( ( resolve, reject ) => {
        const tx = db.transaction( STORE_NAME, 'readonly' );
        const store = tx.objectStore( STORE_NAME );
        const req = store.openCursor( null, 'prev' );
        req.onsuccess = () => {
            const cursor = req.result;
            resolve( cursor ? toRecordingFile( cursor.value ) : null );
        };
        req.onerror = () => reject( req.error );
    } );
}

export async function countRecordings() {
    const db = await openDb();
    return new Promise( ( resolve, reject ) => {
        const tx = db.transaction( STORE_NAME, 'readonly' );
        const req = tx.objectStore( STORE_NAME ).count();
        req.onsuccess = () => resolve( req.result );
        req.onerror = () => reject( req.error );
    } );
}

export async function deleteRecordingFromStore( id ) {
    if ( id == null ) return;
    const db = await openDb();
    return new Promise( ( resolve, reject ) => {
        const tx = db.transaction( STORE_NAME, 'readwrite' );
        const req = tx.objectStore( STORE_NAME ).delete( id );
        req.onsuccess = () => resolve();
        req.onerror = () => reject( req.error );
    } );
}
