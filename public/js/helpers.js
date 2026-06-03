import debugLog from './debug-log.js';

const { trace, log, warn, error: logError } = debugLog;

export default {
    generateRandomString() {
        const crypto = window.crypto || window.msCrypto;
        let array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0].toString(36);
    },


    closeVideo( elemId ) {
        if ( document.getElementById( elemId ) ) {
            document.getElementById( elemId ).remove();
            this.adjustVideoElemSize();
        }
    },


    pageHasFocus() {
        return !( document.hidden || document.onfocusout || window.onpagehide || window.onblur );
    },


    getQString( url = '', keyToReturn = '' ) {
        url = url ? url : location.href;
        let queryStrings = decodeURIComponent( url ).split( '#', 2 )[0].split( '?', 2 )[1];

        if ( queryStrings ) {
            let splittedQStrings = queryStrings.split( '&' );

            if ( splittedQStrings.length ) {
                let queryStringObj = {};

                splittedQStrings.forEach( function ( keyValuePair ) {
                    let keyValue = keyValuePair.split( '=', 2 );

                    if ( keyValue.length ) {
                        queryStringObj[keyValue[0]] = keyValue[1];
                    }
                } );

                return keyToReturn ? ( queryStringObj[keyToReturn] ? queryStringObj[keyToReturn] : null ) : queryStringObj;
            }

            return null;
        }

        return null;
    },


    userMediaAvailable() {
        return !!(
            (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ||
            navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia
        );
    },


    stopMediaStream( stream ) {
        trace( 'media', 'stopMediaStream', {
            tracks: stream?.getTracks?.().map( ( t ) => `${ t.kind }:${ t.readyState }` ),
        } );
        if ( !stream || !stream.getTracks ) return;
        stream.getTracks().forEach( ( track ) => {
            try {
                track.stop();
            } catch {
                /* ignore */
            }
        } );
    },

    mergeMediaStreams( ...streams ) {
        const merged = new MediaStream();
        streams.forEach( ( s ) => {
            if ( s ) s.getTracks().forEach( ( t ) => merged.addTrack( t ) );
        } );
        return merged;
    },

    async getVideoStream() {
        trace( 'media', 'getVideoStream:start' );
        if ( !this.userMediaAvailable() ) {
            throw new Error( 'User media not available' );
        }

        const attempts = [
            () => navigator.mediaDevices.getUserMedia( { video: true, audio: false } ),
            () => navigator.mediaDevices.getUserMedia( {
                video: { facingMode: 'user' },
                audio: false,
            } ),
        ];

        let devices = [];

        try {
            devices = ( await navigator.mediaDevices.enumerateDevices() )
                .filter( ( d ) => d.kind === 'videoinput' && d.deviceId );
        } catch {
            /* ignore */
        }

        devices.forEach( ( device ) => {
            attempts.push( () => navigator.mediaDevices.getUserMedia( {
                video: { deviceId: { ideal: device.deviceId } },
                audio: false,
            } ) );
        } );

        let lastError = null;

        for ( let i = 0; i < attempts.length; i++ ) {
            try {
                const stream = await attempts[i]();
                trace( 'media', 'getVideoStream:ok', { attempt: i, tracks: stream.getTracks().length } );
                return stream;
            } catch ( err ) {
                lastError = err;
                trace( 'media', 'getVideoStream:attempt-failed', { attempt: i, name: err?.name, message: err?.message } );
            }
        }

        logError( 'media', 'getVideoStream:all-failed', { name: lastError?.name } );
        throw lastError || new Error( 'Could not open camera' );
    },

    async queryMediaPermissions() {
        const result = { camera: 'unknown', microphone: 'unknown' };

        if ( !navigator.permissions?.query ) return result;

        try {
            const cam = await navigator.permissions.query( { name: 'camera' } );
            result.camera = cam.state;
        } catch {
            /* unsupported */
        }

        try {
            const mic = await navigator.permissions.query( { name: 'microphone' } );
            result.microphone = mic.state;
        } catch {
            /* unsupported */
        }

        return result;
    },

    getMediaEnvironmentMessage() {
        if ( typeof window === 'undefined' ) return '';

        if ( !window.isSecureContext ) {
            const host = window.location.hostname;
            const isLocal = host === 'localhost' || host === '127.0.0.1';

            if ( !isLocal ) {
                return 'Camera needs HTTPS (or localhost). Opening via http:// on a phone will stay black even if app permissions are ON.';
            }
        }

        return '';
    },

    async getUserFullMedia() {
        trace( 'media', 'getUserFullMedia:start', {
            secureContext: window.isSecureContext,
            href: location.href,
        } );
        if ( !this.userMediaAvailable() ) {
            throw new Error( 'User media not available' );
        }

        if ( !window.isSecureContext ) {
            const err = new Error( 'Camera requires HTTPS or localhost' );
            err.code = 'SECURE_CONTEXT_REQUIRED';
            trace( 'media', 'getUserFullMedia:secure-context-blocked' );
            throw err;
        }

        const audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
        };

        try {
            const stream = await navigator.mediaDevices.getUserMedia( {
                video: true,
                audio: audioConstraints,
            } );
            trace( 'media', 'getUserFullMedia:ok-video+audio', { tracks: stream.getTracks().map( ( t ) => t.kind ) } );
            return stream;
        } catch ( err ) {
            trace( 'media', 'getUserFullMedia:video+audio-failed', { name: err?.name, message: err?.message } );
        }

        try {
            const videoStream = await this.getVideoStream();

            try {
                const audioStream = await navigator.mediaDevices.getUserMedia( {
                    audio: audioConstraints,
                } );
                const merged = this.mergeMediaStreams( videoStream, audioStream );
                trace( 'media', 'getUserFullMedia:ok-merged', { tracks: merged.getTracks().map( ( t ) => t.kind ) } );
                return merged;
            } catch ( audioErr ) {
                trace( 'media', 'getUserFullMedia:ok-video-only', { name: audioErr?.name } );
                return videoStream;
            }
        } catch ( videoErr ) {
            trace( 'media', 'getUserFullMedia:try-audio-only', { name: videoErr?.name } );
            const audioOnly = await navigator.mediaDevices.getUserMedia( { audio: audioConstraints } );
            trace( 'media', 'getUserFullMedia:ok-audio-only' );
            return audioOnly;
        }
    },

    updatePipOverlay( { message, showButton = false } = {} ) {
        const overlay = document.getElementById( 'studio-pip-overlay' );
        const msgEl = document.getElementById( 'studio-pip-msg' );

        if ( !overlay ) return;

        if ( !message ) {
            overlay.hidden = true;
            return;
        }

        overlay.hidden = false;
        if ( msgEl ) msgEl.textContent = message;

        const btn = document.getElementById( 'enable-camera-btn' );
        if ( btn ) btn.hidden = !showButton;
    },


    getUserAudio() {
        if ( this.userMediaAvailable() ) {
            return navigator.mediaDevices.getUserMedia( {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true
                }
            } );
        }

        else {
            throw new Error( 'User media not available' );
        }
    },



    shareScreen() {
        if ( this.userMediaAvailable() ) {
            return navigator.mediaDevices.getDisplayMedia( {
                video: {
                    cursor: "always"
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100
                }
            } );
        }

        else {
            throw new Error( 'User media not available' );
        }
    },


    getIceServer() {
        const servers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
        ];

        if ( typeof window !== 'undefined' && window.__ICE_TURN ) {
            servers.push( window.__ICE_TURN );
        } else if ( typeof window !== 'undefined' && window.__TURN_URLS ) {
            const entry = {
                urls: window.__TURN_URLS,
            };
            if ( window.__TURN_USERNAME ) entry.username = window.__TURN_USERNAME;
            if ( window.__TURN_CREDENTIAL ) entry.credential = window.__TURN_CREDENTIAL;
            servers.push( entry );
        }

        return { iceServers: servers };
    },


    addChat( data, senderType ) {
        const chatMsgDiv = document.querySelector( '#chat-messages' );
        if ( !chatMsgDiv ) return;

        const isLocal = senderType === 'local';
        const senderName = isLocal ? 'You' : data.sender;
        const time = moment().format( 'h:mm A' );
        const safeMsg = xssFilters.inHTMLData( data.msg ).autoLink( { target: '_blank', rel: 'nofollow' } );

        if ( !isLocal ) {
            this.toggleChatNotificationBadge();
            window.peerStudioUi?.logActivity( `<strong>${ senderName }</strong> sent a message` );
        }

        const wrap = document.createElement( 'div' );
        wrap.className = `studio-message studio-message--${ isLocal ? 'local' : 'remote' }`;

        wrap.innerHTML = `
            <div class="studio-message__meta">${ senderName } · ${ time }</div>
            <div class="studio-message__bubble">${ safeMsg }</div>
        `;

        chatMsgDiv.appendChild( wrap );

        if ( this.pageHasFocus() ) {
            wrap.scrollIntoView( { behavior: 'smooth', block: 'end' } );
        }
    },


    toggleChatNotificationBadge() {
        const chatPane = document.querySelector( '#chat-pane' );
        const badge = document.querySelector( '#new-chat-notification' );
        if ( !badge ) return;

        const chatTabActive = chatPane?.classList.contains( 'studio-panel__pane--active' );

        if ( chatTabActive ) {
            badge.setAttribute( 'hidden', true );
        } else {
            badge.removeAttribute( 'hidden' );
        }
    },



    replaceTrack( stream, recipientPeer ) {
        let sender = recipientPeer.getSenders ? recipientPeer.getSenders().find( s => s.track && s.track.kind === stream.kind ) : false;

        sender ? sender.replaceTrack( stream ) : '';
    },



    toggleShareIcons( share ) {
        let shareIconElem = document.querySelector( '#share-screen' );

        if ( share ) {
            shareIconElem.setAttribute( 'title', 'Stop sharing screen' );
            shareIconElem.children[0].classList.add( 'text-primary' );
            shareIconElem.children[0].classList.remove( 'text-white' );
        }

        else {
            shareIconElem.setAttribute( 'title', 'Share screen' );
            shareIconElem.children[0].classList.add( 'text-white' );
            shareIconElem.children[0].classList.remove( 'text-primary' );
        }
    },


    toggleVideoBtnDisabled( disabled ) {
        document.getElementById( 'toggle-video' ).disabled = disabled;
    },


    maximiseStream( e ) {
        const btn = e.target.closest( '.expand-remote-video' ) || e.target;
        const video =
            btn.closest( '.card' )?.querySelector( 'video' ) ||
            btn.parentElement?.previousElementSibling;

        if ( !video ) return;

        video.requestFullscreen() ||
            video.mozRequestFullScreen() ||
            video.webkitRequestFullscreen() ||
            video.msRequestFullscreen();
    },


    toggleRemoteVideoFocus( e ) {
        const btn = e.target.closest( '.expand-remote-video' );
        const card = btn?.closest( '.card.card-sm' );
        if ( !card || !btn ) return;

        const videosEl = document.getElementById( 'videos' );
        const isFocused = card.classList.toggle( 'video-focused' );

        if ( videosEl ) {
            videosEl.classList.toggle( 'videos-has-focus', isFocused );
        }

        const icon = btn.querySelector( 'i' );
        const label = btn.querySelector( 'span' );

        if ( icon ) {
            icon.classList.toggle( 'fa-expand', !isFocused );
            icon.classList.toggle( 'fa-compress', isFocused );
        }

        if ( label ) {
            label.textContent = isFocused ? 'Shrink' : 'Enlarge';
        }

        btn.setAttribute( 'title', isFocused ? 'Restore size' : 'Enlarge video' );

        if ( isFocused ) {
            card.style.width = '100%';
        } else {
            this.adjustVideoElemSize();
        }
    },


    singleStreamToggleMute( e ) {
        const btn = e.target.closest ? e.target.closest( '.mute-remote-mic' ) : e.target;
        if ( !btn ) return;

        const card = btn.closest( '.card' );
        const video = card ? card.querySelector( 'video' ) : btn.parentElement.previousElementSibling;
        const icon = btn.querySelector( 'i' );
        const label = btn.querySelector( 'span' );

        if ( !video ) return;

        video.muted = !video.muted;

        if ( icon ) {
            icon.classList.toggle( 'fa-volume-up', !video.muted );
            icon.classList.toggle( 'fa-volume-mute', video.muted );
        }

        if ( label ) {
            label.textContent = video.muted ? 'Unmute' : 'Mute';
        }

        btn.setAttribute(
            'title',
            video.muted ? 'Unmute this person' : 'Mute this person'
        );
        btn.classList.toggle( 'is-muted', video.muted );
    },


    getRecordingMimeType() {
        const types = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm',
        ];
        for (const type of types) {
            if (window.MediaRecorder && MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return '';
    },


    createRecordingFile( chunks, label ) {
        const blob = new Blob( chunks, { type: 'video/webm' } );
        const filename = `${ label }-${ moment().format( 'YYYY-MM-DD-HHmm' ) }.webm`;
        return { blob, filename, url: URL.createObjectURL( blob ) };
    },


    downloadRecording( recordingFile ) {
        if ( !recordingFile ) return;
        const file = new File( [recordingFile.blob], recordingFile.filename, {
            type: 'video/webm',
        } );
        saveAs( file );
    },


    revokeRecordingUrl( recordingFile ) {
        if ( recordingFile && recordingFile.url ) {
            URL.revokeObjectURL( recordingFile.url );
        }
    },


    saveRecordedStream( stream, user ) {
        const recordingFile = this.createRecordingFile( stream, user );
        this.downloadRecording( recordingFile );
        this.revokeRecordingUrl( recordingFile );
    },


    toggleModal( id, show ) {
        let el = document.getElementById( id );

        if ( show ) {
            el.style.display = 'block';
            el.removeAttribute( 'aria-hidden' );
        }

        else {
            el.style.display = 'none';
            el.setAttribute( 'aria-hidden', true );
        }
    },



    setLocalStream( stream, mirrorMode = true ) {
        trace( 'media', 'setLocalStream', {
            hasStream: !!stream,
            mirrorMode,
            videoTracks: stream?.getVideoTracks?.().length,
            audioTracks: stream?.getAudioTracks?.().length,
        } );
        const localVidElem = document.getElementById( 'local' );
        if ( !localVidElem || !stream ) {
            this.updatePipOverlay( {
                message: 'Camera not started',
                showButton: true,
            } );
            return;
        }

        const videoTrack = stream.getVideoTracks()[0];

        if ( !videoTrack ) {
            this.updatePipOverlay( {
                message: 'Microphone only — no camera detected',
                showButton: true,
            } );
            localVidElem.srcObject = null;
            return;
        }

        if ( videoTrack.readyState === 'ended' ) {
            this.updatePipOverlay( {
                message: 'Camera stopped — click to restart',
                showButton: true,
            } );
            return;
        }

        if ( localVidElem.srcObject && localVidElem.srcObject !== stream ) {
            this.stopMediaStream( localVidElem.srcObject );
        }

        localVidElem.srcObject = stream;
        localVidElem.muted = true;
        localVidElem.defaultMuted = true;
        localVidElem.setAttribute( 'playsinline', '' );
        localVidElem.setAttribute( 'webkit-playsinline', '' );
        localVidElem.playsInline = true;
        localVidElem.autoplay = true;
        mirrorMode
            ? localVidElem.classList.add( 'mirror-mode' )
            : localVidElem.classList.remove( 'mirror-mode' );

        const playVideo = () => {
            const playPromise = localVidElem.play();

            if ( playPromise && typeof playPromise.then === 'function' ) {
                playPromise
                    .then( () => {
                        trace( 'media', 'setLocalStream:play-ok' );
                        this.updatePipOverlay( { message: null } );
                    } )
                    .catch( ( playErr ) => {
                        logError( 'media', 'setLocalStream:play-failed', { message: playErr?.message } );
                        this.updatePipOverlay( {
                            message: 'Click to start camera',
                            showButton: true,
                        } );
                    } );
            } else {
                this.updatePipOverlay( { message: null } );
            }
        };

        if ( localVidElem.readyState >= 1 ) {
            playVideo();
        } else {
            localVidElem.onloadedmetadata = () => playVideo();
        }

        videoTrack.onended = () => {
            this.updatePipOverlay( {
                message: 'Camera disconnected',
                showButton: true,
            } );
        };

        videoTrack.onmute = () => {
            if ( !videoTrack.enabled ) {
                this.updatePipOverlay( { message: 'Camera turned off' } );
            }
        };

        videoTrack.onunmute = () => {
            if ( videoTrack.enabled && localVidElem.srcObject ) {
                this.updatePipOverlay( { message: null } );
            }
        };
    },


    adjustVideoElemSize() {
        const elem = document.querySelectorAll( '#videos .card.card-sm' );
        const totalRemoteVideosDesktop = elem.length;
        let newWidth = totalRemoteVideosDesktop === 1 ? '100%' : (
            totalRemoteVideosDesktop === 2 ? '50%' : (
            totalRemoteVideosDesktop == 3 ? '33.33%' : (
                totalRemoteVideosDesktop <= 8 ? '25%' : (
                    totalRemoteVideosDesktop <= 15 ? '20%' : (
                        totalRemoteVideosDesktop <= 18 ? '16%' : (
                            totalRemoteVideosDesktop <= 23 ? '15%' : (
                                totalRemoteVideosDesktop <= 32 ? '12%' : '10%'
                            )
                        )
                    )
                )
            )
        ));


        for ( let i = 0; i < totalRemoteVideosDesktop; i++ ) {
            if ( elem[i].classList.contains( 'video-focused' ) ) {
                elem[i].style.width = '100%';
            } else {
                elem[i].style.width = newWidth;
            }
        }
    },


    createDemoRemotes( str, total = 6 ) {
        let i = 0;

        let testInterval = setInterval( () => {
            let newVid = document.createElement( 'video' );
            newVid.id = `demo-${ i }-video`;
            newVid.srcObject = str;
            newVid.autoplay = true;
            newVid.className = 'remote-video';

            //video controls elements
            let controlDiv = document.createElement( 'div' );
            controlDiv.className = 'remote-video-controls';
            controlDiv.innerHTML = `<button type="button" class="remote-control-btn mute-remote-mic" title="Mute this person">
                <i class="fa fa-volume-up"></i>
                <span>Mute</span>
            </button>
            <button type="button" class="remote-control-btn expand-remote-video" title="Enlarge video">
                <i class="fa fa-expand"></i>
                <span>Enlarge</span>
            </button>`;

            //create a new div for card
            let cardDiv = document.createElement( 'div' );
            cardDiv.className = 'card card-sm';
            cardDiv.id = `demo-${ i }`;
            cardDiv.appendChild( newVid );
            cardDiv.appendChild( controlDiv );

            //put div in main-section elem
            document.getElementById( 'videos' ).appendChild( cardDiv );

            this.adjustVideoElemSize();

            i++;

            if ( i == total ) {
                clearInterval( testInterval );
            }
        }, 2000 );
    }
};
