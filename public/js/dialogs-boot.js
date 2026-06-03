/**
 * Synchronous dialog bootstrap (classic script, not a module).
 * Loads before deferred modules so cached bundles never show native confirm/alert.
 */
( function () {
    'use strict';

    var rootEl = null;
    var dialogQueue = Promise.resolve();

    function enqueue( fn ) {
        var run = dialogQueue.then( fn, fn );
        dialogQueue = run.then( function () {}, function () {} );
        return run;
    }

    function normalizeOptions( options, defaults ) {
        if ( typeof options === 'string' ) {
            var o = {};
            for ( var k in defaults ) {
                if ( Object.prototype.hasOwnProperty.call( defaults, k ) ) o[ k ] = defaults[ k ];
            }
            o.message = options;
            return o;
        }
        var merged = {};
        for ( var d in defaults ) {
            if ( Object.prototype.hasOwnProperty.call( defaults, d ) ) merged[ d ] = defaults[ d ];
        }
        for ( var key in options ) {
            if ( Object.prototype.hasOwnProperty.call( options, key ) ) merged[ key ] = options[ key ];
        }
        return merged;
    }

    function ensureRoot() {
        if ( rootEl ) return rootEl;
        rootEl = document.getElementById( 'cm-confirm-root' );
        if ( rootEl ) return rootEl;

        rootEl = document.createElement( 'div' );
        rootEl.id = 'cm-confirm-root';
        rootEl.className = 'cm-confirm-overlay';
        rootEl.hidden = true;
        rootEl.innerHTML =
            '<div class="cm-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cm-confirm-title" aria-describedby="cm-confirm-message">' +
            '<div class="cm-confirm__icon" id="cm-confirm-icon" aria-hidden="true"></div>' +
            '<h3 class="cm-confirm__title" id="cm-confirm-title"></h3>' +
            '<p class="cm-confirm__message" id="cm-confirm-message"></p>' +
            '<input type="text" class="cm-confirm__input" id="cm-confirm-input" hidden autocomplete="off">' +
            '<div class="cm-confirm__actions">' +
            '<button type="button" class="cm-confirm__btn cm-confirm__btn--cancel" id="cm-confirm-cancel">Cancel</button>' +
            '<button type="button" class="cm-confirm__btn cm-confirm__btn--confirm" id="cm-confirm-ok">OK</button>' +
            '</div></div>';

        document.body.appendChild( rootEl );
        rootEl.addEventListener( 'click', function ( e ) {
            if ( e.target === rootEl ) e.stopPropagation();
        } );
        return rootEl;
    }

    function iconHtml( variant ) {
        if ( variant === 'danger' ) return '<i class="fas fa-trash-alt"></i>';
        if ( variant === 'warning' ) return '<i class="fas fa-exclamation-triangle"></i>';
        if ( variant === 'success' ) return '<i class="fas fa-check"></i>';
        return '<i class="fas fa-info-circle"></i>';
    }

    function presentDialog( mode, options ) {
        return enqueue( function () {
            return new Promise( function ( resolve ) {
                var root = ensureRoot();
                var icon = root.querySelector( '#cm-confirm-icon' );
                var titleEl = root.querySelector( '#cm-confirm-title' );
                var messageEl = root.querySelector( '#cm-confirm-message' );
                var inputEl = root.querySelector( '#cm-confirm-input' );
                var cancelBtn = root.querySelector( '#cm-confirm-cancel' );
                var okBtn = root.querySelector( '#cm-confirm-ok' );
                var isAlert = mode === 'alert';
                var isPrompt = mode === 'prompt';
                var variant = options.variant || ( isAlert ? 'info' : 'danger' );

                icon.className = 'cm-confirm__icon cm-confirm__icon--' + variant;
                icon.innerHTML = iconHtml( variant );
                titleEl.textContent = options.title || '';
                messageEl.textContent = options.message || '';

                if ( isPrompt ) {
                    inputEl.hidden = false;
                    inputEl.placeholder = options.placeholder || '';
                    inputEl.value = options.defaultValue || '';
                    inputEl.classList.remove( 'cm-confirm__input--error' );
                } else {
                    inputEl.hidden = true;
                    inputEl.value = '';
                }

                cancelBtn.hidden = isAlert;
                cancelBtn.textContent = options.cancelLabel || 'Cancel';
                okBtn.textContent = options.confirmLabel || ( isAlert ? 'OK' : 'Confirm' );
                okBtn.className = 'cm-confirm__btn cm-confirm__btn--confirm';
                if ( variant === 'danger' && !isAlert ) {
                    okBtn.classList.add( 'cm-confirm__btn--danger' );
                } else {
                    okBtn.classList.remove( 'cm-confirm__btn--danger' );
                }

                root.hidden = false;
                requestAnimationFrame( function () {
                    root.classList.add( 'cm-confirm-overlay--visible' );
                } );

                function teardown() {
                    root.classList.remove( 'cm-confirm-overlay--visible' );
                    setTimeout( function () {
                        root.hidden = true;
                        inputEl.hidden = true;
                    }, 200 );
                    document.removeEventListener( 'keydown', onKey );
                    cancelBtn.removeEventListener( 'click', onCancel );
                    okBtn.removeEventListener( 'click', onOk );
                }

                function onCancel() {
                    teardown();
                    resolve( isPrompt ? null : false );
                }

                function onOk() {
                    if ( isPrompt ) {
                        var v = inputEl.value.trim();
                        if ( !v && options.required !== false ) {
                            inputEl.classList.add( 'cm-confirm__input--error' );
                            inputEl.focus();
                            return;
                        }
                        teardown();
                        resolve( v || null );
                        return;
                    }
                    teardown();
                    resolve( isAlert ? undefined : true );
                }

                function onKey( e ) {
                    if ( e.key === 'Escape' && !isAlert ) onCancel();
                    if ( e.key === 'Enter' ) onOk();
                }

                cancelBtn.addEventListener( 'click', onCancel );
                okBtn.addEventListener( 'click', onOk );
                document.addEventListener( 'keydown', onKey );

                if ( isAlert ) okBtn.focus();
                else cancelBtn.focus();
            } );
        } );
    }

    function showConfirm( options ) {
        var opts = normalizeOptions( options, {
            title: 'Are you sure?',
            message: '',
            confirmLabel: 'Confirm',
            cancelLabel: 'Cancel',
            variant: 'danger',
        } );
        return presentDialog( 'confirm', opts );
    }

    function showAlert( options ) {
        var opts = normalizeOptions( options, {
            title: 'Notice',
            message: '',
            confirmLabel: 'OK',
            variant: 'info',
        } );
        return presentDialog( 'alert', opts );
    }

    function legacyConfirmOptions( message ) {
        var msg = String( message );
        if ( msg.indexOf( 'already have a recording' ) !== -1 ) {
            return {
                title: 'Start new recording?',
                message: msg,
                confirmLabel: 'Start new recording',
                cancelLabel: 'Cancel',
                variant: 'warning',
            };
        }
        return {
            title: 'Confirm',
            message: msg,
            confirmLabel: 'OK',
            cancelLabel: 'Cancel',
            variant: 'warning',
        };
    }

    window.cmDialog = {
        confirm: showConfirm,
        alert: showAlert,
        prompt: function () {
            return Promise.resolve( null );
        },
    };
    window.__cmDialogsReady = true;

    window.confirm = function ( message ) {
        void showConfirm( legacyConfirmOptions( message ) );
        return false;
    };

    window.alert = function ( message ) {
        void showAlert( {
            title: 'Notice',
            message: String( message ),
            variant: 'info',
        } );
    };
} )();
