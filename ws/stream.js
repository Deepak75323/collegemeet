const { getSession, updateFile, addFile, removeFile, renameFile } = require( './codeSession.js' );
const wsDebug = require( '../utils/ws-debug.js' );

const stream = ( socket ) => {
    wsDebug.trace( 'connection', { socketId: socket.id, transport: socket.conn?.transport?.name } );

    socket.on( 'subscribe', async ( data ) => {
        wsDebug.trace( 'subscribe:start', { socketId: socket.id, room: data?.room } );

        if ( !data?.room ) return;

        const socketId = socket.id;

        if ( socket.data.subscribedRoom && socket.data.subscribedRoom !== data.room ) {
            socket.leave( socket.data.subscribedRoom );
        }

        socket.data.subscribedRoom = data.room;
        socket.join( data.room );
        socket.join( socketId );

        socket.to( data.room ).emit( 'new user', { socketId } );

        const peersInRoom = [];

        try {
            const remoteSockets = await socket.nsp.in( data.room ).fetchSockets();
            remoteSockets.forEach( ( remote ) => {
                if ( remote.id === socketId ) return;
                peersInRoom.push( remote.id );
                socket.emit( 'new user', { socketId: remote.id } );
                wsDebug.trace( 'subscribe:announce-peer', { to: socketId, peerId: remote.id } );
            } );
        } catch ( err ) {
            wsDebug.warn( 'subscribe:fetch-peers-failed', { message: err?.message } );
            const roomSet = socket.adapter.rooms.get( data.room );
            if ( roomSet ) {
                roomSet.forEach( ( peerId ) => {
                    if ( peerId === socketId || peerId === data.room ) return;
                    peersInRoom.push( peerId );
                    socket.emit( 'new user', { socketId: peerId } );
                } );
            }
        }

        const session = getSession( data.room );
        socket.emit( 'code:state', session );
        wsDebug.log( 'subscribe:ok', { room: data.room, socketId, peerCount: peersInRoom.length } );
    } );

    // ── File content update (replaces code:update) ───────────────────────────
    socket.on( 'file:update', ( data ) => {
        if ( !data?.room || !data?.fileId ) return;

        const session = updateFile( data.room, {
            fileId: data.fileId,
            code: data.code,
            language: data.language,
        } );

        socket.to( data.room ).emit( 'file:update', {
            fileId: data.fileId,
            code: data.code,
            language: data.language,
            sender: data.sender,
            senderId: socket.id,
        } );

        wsDebug.trace( 'file:update:relay', { room: data.room, fileId: data.fileId, bytes: data.code?.length } );
    } );

    // Legacy code:update — keep for backward compat, treat as f1
    socket.on( 'code:update', ( data ) => {
        if ( !data?.room ) return;

        const session = updateFile( data.room, {
            fileId: 'f1',
            code: data.code,
            language: data.language,
        } );

        socket.to( data.room ).emit( 'file:update', {
            fileId: 'f1',
            code: data.code,
            language: data.language,
            sender: data.sender,
            senderId: socket.id,
        } );
    } );

    // ── File management ───────────────────────────────────────────────────────
    socket.on( 'file:create', ( data ) => {
        if ( !data?.room || !data?.file ) return;
        addFile( data.room, data.file );
        socket.to( data.room ).emit( 'file:create', { file: data.file } );
        wsDebug.trace( 'file:create', { room: data.room, fileId: data.file.id } );
    } );

    socket.on( 'file:delete', ( data ) => {
        if ( !data?.room || !data?.fileId ) return;
        removeFile( data.room, data.fileId );
        socket.to( data.room ).emit( 'file:delete', { fileId: data.fileId } );
        wsDebug.trace( 'file:delete', { room: data.room, fileId: data.fileId } );
    } );

    socket.on( 'file:rename', ( data ) => {
        if ( !data?.room || !data?.fileId || !data?.name ) return;
        renameFile( data.room, data.fileId, data.name );
        socket.to( data.room ).emit( 'file:rename', { fileId: data.fileId, name: data.name } );
        wsDebug.trace( 'file:rename', { room: data.room, fileId: data.fileId, name: data.name } );
    } );

    // ── Cursor ───────────────────────────────────────────────────────────────
    socket.on( 'code:cursor', ( data ) => {
        if ( !data?.room || !data?.sender ) return;
        socket.to( data.room ).emit( 'code:cursor', {
            sender: data.sender,
            fileId: data.fileId,
            line: data.line,
            ch: data.ch,
        } );
    } );

    // ── Terminal output sync ──────────────────────────────────────────────────
    socket.on( 'terminal:output', ( data ) => {
        if ( !data?.room ) return;
        socket.to( data.room ).emit( 'terminal:output', {
            output: data.output,
            lang: data.lang,
            sender: data.sender,
        } );
        wsDebug.trace( 'terminal:output:relay', { room: data.room, bytes: data.output?.length } );
    } );

    // ── User name broadcast ───────────────────────────────────────────────────
    socket.on( 'user-announce', ( data ) => {
        if ( !data?.room || !data?.username ) return;
        wsDebug.trace( 'user-announce:relay', { from: socket.id, room: data.room, username: data.username } );
        socket.to( data.room ).emit( 'user-announce', {
            socketId: socket.id,
            username: data.username,
        } );
    } );

    // ── WebRTC signaling ──────────────────────────────────────────────────────
    socket.on( 'webrtc-signal', ( data ) => {
        if ( !data?.to || !data?.signal ) return;
        socket.to( data.to ).emit( 'webrtc-signal', { sender: socket.id, signal: data.signal } );
        wsDebug.trace( 'webrtc-signal:relay', { from: socket.id, to: data.to } );
    } );

    // ── Chat ──────────────────────────────────────────────────────────────────
    socket.on( 'chat', ( data ) => {
        if ( !data?.room ) return;
        socket.to( data.room ).emit( 'chat', { sender: data.sender, msg: data.msg } );
        wsDebug.trace( 'chat:relay', { room: data.room, sender: data.sender } );
    } );

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on( 'disconnect', ( reason ) => {
        wsDebug.log( 'disconnect', { socketId: socket.id, room: socket.data.subscribedRoom, reason } );
        if ( socket.data.subscribedRoom ) {
            socket.to( socket.data.subscribedRoom ).emit( 'user left', { socketId: socket.id } );
        }
    } );

    socket.on( 'error', ( err ) => {
        wsDebug.error( 'socket:error', { socketId: socket.id, message: err?.message } );
    } );
};

module.exports = stream;
