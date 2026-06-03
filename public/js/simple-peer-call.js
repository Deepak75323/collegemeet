/**
 * WebRTC via simple-peer (reliable P2P) + Socket.io signaling.
 * Replaces hand-rolled RTCPeerConnection SDP/ICE handling.
 */

import debugLog from './debug-log.js';

const { trace, warn, error } = debugLog;

export function createCallManager( options ) {
    const {
        socket,
        getSocketId,
        getLocalStream,
        getIceConfig,
        onRemoteStream,
        onPeerLeft,
        onPeerConnected,
    } = options;

    const peers = {};

    function destroyPeer( partnerId ) {
        if ( !peers[partnerId] ) return;
        try {
            peers[partnerId].destroy();
        } catch ( err ) {
            warn( 'webrtc', 'peer destroy failed', { partnerId, err: String( err ) } );
        }
        delete peers[partnerId];
        trace( 'webrtc', 'peer destroyed', { partnerId } );
    }

    function destroyAll() {
        Object.keys( peers ).forEach( destroyPeer );
    }

    function connectTo( partnerId, initiator ) {
        if ( peers[partnerId] ) return peers[partnerId];

        const stream = getLocalStream();
        if ( !stream ) {
            warn( 'webrtc', 'No local stream yet; waiting for camera', { partnerId, initiator } );
            return null;
        }

        if ( typeof window.SimplePeer !== 'function' ) {
            error( 'webrtc', 'SimplePeer library not loaded — check /js/vendor/simplepeer.min.js' );
            return null;
        }

        const iceConfig = getIceConfig();
        trace( 'webrtc', 'connectTo', {
            partnerId,
            initiator,
            myId: getSocketId(),
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length,
            iceServers: iceConfig?.iceServers?.length,
        } );

        const peer = new window.SimplePeer( {
            initiator,
            trickle: true,
            stream,
            config: iceConfig,
        } );

        peer.on( 'signal', ( signal ) => {
            trace( 'webrtc', 'signal out', {
                partnerId,
                type: signal?.type || ( signal?.candidate ? 'candidate' : 'unknown' ),
            } );
            socket.emit( 'webrtc-signal', {
                to: partnerId,
                signal,
                sender: getSocketId(),
            } );
        } );

        peer.on( 'stream', ( remoteStream ) => {
            trace( 'webrtc', 'remote stream', {
                partnerId,
                tracks: remoteStream.getTracks().map( ( t ) => `${ t.kind }:${ t.readyState }` ),
            } );
            onRemoteStream( partnerId, remoteStream );
            onPeerConnected?.( partnerId );
        } );

        peer.on( 'connect', () => {
            trace( 'webrtc', 'peer connected (data channel)', { partnerId } );
            onPeerConnected?.( partnerId );
        } );

        peer.on( 'close', () => {
            trace( 'webrtc', 'peer closed', { partnerId } );
            destroyPeer( partnerId );
            onPeerLeft( partnerId );
        } );

        peer.on( 'error', ( err ) => {
            error( 'webrtc', 'peer error', { partnerId, message: err?.message || String( err ) } );
            destroyPeer( partnerId );
            onPeerLeft( partnerId );
        } );

        peers[partnerId] = peer;
        return peer;
    }

    function handleSignal( sender, signal ) {
        if ( !sender || !signal ) return;

        let peer = peers[sender];
        if ( !peer ) {
            peer = connectTo( sender, false );
        }

        if ( !peer ) return;

        try {
            trace( 'webrtc', 'signal in', {
                sender,
                type: signal?.type || ( signal?.candidate ? 'candidate' : 'unknown' ),
            } );
            peer.signal( signal );
        } catch ( err ) {
            error( 'webrtc', 'signal apply failed', { sender, message: err?.message || String( err ) } );
        }
    }

    function handleNewUser( partnerId ) {
        const myId = getSocketId();
        if ( !partnerId || partnerId === myId || peers[partnerId] ) {
            trace( 'webrtc', 'handleNewUser skipped', { partnerId, myId, alreadyPeer: !!peers[partnerId] } );
            return;
        }

        const willInitiate = myId < partnerId;
        trace( 'webrtc', 'handleNewUser', { partnerId, myId, willInitiate } );

        if ( willInitiate ) {
            connectTo( partnerId, true );
        }
    }

    function rebuildAllConnections( partnerIds ) {
        const ids = partnerIds && partnerIds.length
            ? partnerIds
            : Object.keys( peers );

        ids.forEach( destroyPeer );
        ids.forEach( ( partnerId ) => handleNewUser( partnerId ) );
    }

    /**
     * Swap the outbound video track on every live peer connection without
     * tearing down the connection (uses RTCRtpSender.replaceTrack).
     * Pass null to remove the video track (mute video).
     */
    function replaceVideoTrack( newTrack ) {
        Object.entries( peers ).forEach( ( [ partnerId, peer ] ) => {
            const pc = peer._pc;
            if ( !pc ) return;

            // Primary: find sender whose current track is video.
            let sender = pc.getSenders().find( ( s ) => s.track?.kind === 'video' );

            // Fallback: after replaceTrack(null), sender.track becomes null so the
            // check above fails.  Use the transceiver's *receiver* track kind —
            // it always retains 'video' regardless of the sender's track state.
            if ( !sender ) {
                const videoTransceiver = pc.getTransceivers().find(
                    ( t ) => t.receiver?.track?.kind === 'video'
                );
                sender = videoTransceiver?.sender ?? null;
            }

            if ( !sender ) {
                warn( 'webrtc', 'replaceTrack: no video sender found', { partnerId } );
                return;
            }

            sender.replaceTrack( newTrack || null ).catch( ( err ) => {
                warn( 'webrtc', 'replaceTrack failed', { partnerId, message: err?.message } );
            } );
        } );
    }

    function syncKnownPeers( partnerIds ) {
        if ( !partnerIds || !partnerIds.length ) return;

        partnerIds.forEach( ( partnerId ) => {
            if ( !partnerId || partnerId === getSocketId() ) return;
            handleNewUser( partnerId );
        } );
    }

    function bindSocketHandlers() {
        socket.on( 'webrtc-signal', ( data ) => {
            handleSignal( data.sender, data.signal );
        } );
    }

    return {
        peers,
        connectTo,
        destroyPeer,
        destroyAll,
        handleSignal,
        handleNewUser,
        rebuildAllConnections,
        replaceVideoTrack,
        syncKnownPeers,
        bindSocketHandlers,
    };
}
