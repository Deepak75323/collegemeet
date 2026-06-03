/**
 * App-wide custom dialogs — replaces window.confirm, alert, and prompt.
 * Use showConfirm / showAlert / showPrompt with dynamic title, message, and labels.
 */

let rootEl = null;
let dialogQueue = Promise.resolve();

function enqueue( fn ) {
    const run = dialogQueue.then( fn, fn );
    dialogQueue = run.then( () => {}, () => {} );
    return run;
}

function normalizeOptions( options, defaults ) {
    if ( typeof options === 'string' ) {
        return { ...defaults, message: options };
    }
    return { ...defaults, ...options };
}

function ensureRoot() {
    if ( rootEl ) return rootEl;

    const existing = document.getElementById( 'cm-confirm-root' );
    if ( existing ) {
        rootEl = existing;
        return rootEl;
    }

    rootEl = document.createElement( 'div' );
    rootEl.id = 'cm-confirm-root';
    rootEl.className = 'cm-confirm-overlay';
    rootEl.hidden = true;
    rootEl.innerHTML = `
      <div class="cm-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cm-confirm-title" aria-describedby="cm-confirm-message">
        <div class="cm-confirm__icon" id="cm-confirm-icon" aria-hidden="true"></div>
        <h3 class="cm-confirm__title" id="cm-confirm-title"></h3>
        <p class="cm-confirm__message" id="cm-confirm-message"></p>
        <input type="text" class="cm-confirm__input" id="cm-confirm-input" hidden autocomplete="off">
        <div class="cm-confirm__actions">
          <button type="button" class="cm-confirm__btn cm-confirm__btn--cancel" id="cm-confirm-cancel">Cancel</button>
          <button type="button" class="cm-confirm__btn cm-confirm__btn--confirm" id="cm-confirm-ok">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild( rootEl );

    rootEl.addEventListener( 'click', ( e ) => {
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

/**
 * @param {'confirm'|'alert'|'prompt'} mode
 * @param {object} options
 */
function presentDialog( mode, options ) {
    return enqueue( () => new Promise( ( resolve ) => {
        const root = ensureRoot();
        const icon = root.querySelector( '#cm-confirm-icon' );
        const titleEl = root.querySelector( '#cm-confirm-title' );
        const messageEl = root.querySelector( '#cm-confirm-message' );
        const inputEl = root.querySelector( '#cm-confirm-input' );
        const cancelBtn = root.querySelector( '#cm-confirm-cancel' );
        const okBtn = root.querySelector( '#cm-confirm-ok' );
        const isAlert = mode === 'alert';
        const isPrompt = mode === 'prompt';

        const variant = options.variant || ( isAlert ? 'info' : 'danger' );

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
        requestAnimationFrame( () => root.classList.add( 'cm-confirm-overlay--visible' ) );

        function onInput() {
            inputEl.classList.remove( 'cm-confirm__input--error' );
        }

        function teardown() {
            inputEl.removeEventListener( 'input', onInput );
            root.classList.remove( 'cm-confirm-overlay--visible' );
            setTimeout( () => {
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
                const v = inputEl.value.trim();
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

        if ( isPrompt ) inputEl.addEventListener( 'input', onInput );
        cancelBtn.addEventListener( 'click', onCancel );
        okBtn.addEventListener( 'click', onOk );
        document.addEventListener( 'keydown', onKey );

        if ( isPrompt ) {
            setTimeout( () => inputEl.focus(), 50 );
        } else if ( isAlert ) {
            okBtn.focus();
        } else {
            cancelBtn.focus();
        }
    } ) );
}

/**
 * @param {string|object} options
 * @returns {Promise<boolean>}
 */
export function showConfirm( options ) {
    const opts = normalizeOptions( options, {
        title: 'Are you sure?',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        variant: 'danger',
    } );
    return presentDialog( 'confirm', opts );
}

/**
 * @param {string|object} options
 * @returns {Promise<void>}
 */
export function showAlert( options ) {
    const opts = normalizeOptions( options, {
        title: 'Notice',
        message: '',
        confirmLabel: 'OK',
        variant: 'info',
    } );
    return presentDialog( 'alert', opts );
}

/**
 * @param {string|object} options
 * @returns {Promise<string|null>}
 */
export function showPrompt( options ) {
    const opts = normalizeOptions( options, {
        title: 'Enter a value',
        message: '',
        placeholder: '',
        defaultValue: '',
        confirmLabel: 'OK',
        cancelLabel: 'Cancel',
        variant: 'primary',
    } );
    return presentDialog( 'prompt', opts );
}

export const cmDialog = {
    confirm: showConfirm,
    alert: showAlert,
    prompt: showPrompt,
};

/** Ensure dialogs are available (room page module load order). */
export async function getCmDialog() {
    if ( window.cmDialog ) return window.cmDialog;
    window.cmDialog = cmDialog;
    return cmDialog;
}

export default cmDialog;
