import helpers from './helpers.js';
import debugLog from './debug-log.js';

const { trace } = debugLog;

window.addEventListener( 'load', () => {
    trace( 'events', 'load' );

    const localVideo = document.getElementById( 'local' );
    const pip = document.querySelector( '.studio-pip' );

    if ( ( pip || localVideo ) && localVideo ) {
        ( pip || localVideo ).addEventListener( 'click', ( e ) => {
            // Let the enable-camera button handle its own click
            if ( e.target.closest( '#enable-camera-btn' ) ) return;

            // Only attempt PiP when video is actually playing
            if ( !localVideo.srcObject || localVideo.readyState < 1 ) return;

            trace( 'events', 'pip picture-in-picture toggle' );
            if ( !document.pictureInPictureElement ) {
                localVideo.requestPictureInPicture().catch( ( err ) => {
                    debugLog.warn( 'events', 'PiP failed', { message: err?.message } );
                } );
            } else {
                document.exitPictureInPicture().catch( ( err ) => {
                    debugLog.warn( 'events', 'exit PiP failed', { message: err?.message } );
                } );
            }
        } );
    }

    const createRoomBtn = document.getElementById( 'create-room' );
    if ( createRoomBtn ) {
        createRoomBtn.addEventListener( 'click', ( e ) => {
            e.preventDefault();
            trace( 'events', 'create-room click' );

            const roomName = document.querySelector( '#room-name' ).value;
            const yourName = document.querySelector( '#your-name' ).value;

            if ( roomName && yourName ) {
                document.querySelector( '#err-msg' ).innerText = '';
                sessionStorage.setItem( 'username', yourName );

                const roomId = `${ roomName.trim().replace( /\s+/g, '_' ) }_${ helpers.generateRandomString() }`;
                const roomLink = `${ location.origin }/room/?room=${ encodeURIComponent( roomId ) }`;

                trace( 'events', 'create-room redirect', { roomId, roomLink } );

                document.querySelector( '#room-created' ).innerHTML =
                    `Opening session… Share this link with your partner: <a href="${ roomLink }">${ roomLink }</a>`;

                window.location.href = roomLink;
            } else {
                trace( 'events', 'create-room validation failed' );
                document.querySelector( '#err-msg' ).innerText = 'All fields are required';
            }
        } );
    }

    const enterRoomBtn = document.getElementById( 'enter-room' );
    if ( enterRoomBtn ) {
        enterRoomBtn.addEventListener( 'click', ( e ) => {
            e.preventDefault();
            trace( 'events', 'enter-room click' );

            const name = document.querySelector( '#username' ).value;

            if ( name ) {
                document.querySelector( '#err-msg-username' ).innerText = '';
                sessionStorage.setItem( 'username', name );
                trace( 'events', 'enter-room reload', { username: name } );
                location.reload();
            } else {
                trace( 'events', 'enter-room validation failed' );
                document.querySelector( '#err-msg-username' ).innerText = 'Please enter your name';
            }
        } );
    }

    document.addEventListener( 'click', ( e ) => {
        const expandBtn = e.target.closest( '.expand-remote-video' );
        const muteBtn = e.target.closest( '.mute-remote-mic' );

        if ( expandBtn ) {
            trace( 'events', 'expand remote video' );
            helpers.toggleRemoteVideoFocus( e );
        } else if ( muteBtn ) {
            trace( 'events', 'mute remote video' );
            helpers.singleStreamToggleMute( { target: muteBtn } );
        }
    } );

    const closeModalBtn = document.getElementById( 'closeModal' );
    if ( closeModalBtn ) {
        closeModalBtn.addEventListener( 'click', () => {
            trace( 'events', 'close end-call modal' );
            helpers.toggleModal( 'end-call-modal', false );
        } );
    }
} );
