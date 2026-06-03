import debugLog from './debug-log.js';
import { showConfirm, showPrompt } from './confirm-dialog.js';

const { trace, warn } = debugLog;

let codeCollabApi = null;

export function registerCodeCollab( api ) { codeCollabApi = api; }
export function getCodeCollab() { return codeCollabApi; }

const MODES = {
    javascript: 'javascript',
    python: 'python',
    html: 'htmlmixed',
    css: 'css',
    cpp: 'text/x-c++src',
    java: 'text/x-java',
};

function fileIcon( name ) {
    if ( name.endsWith( '.js' ) ) return 'fa-file-code';
    if ( name.endsWith( '.md' ) ) return 'fa-file-alt';
    if ( name.endsWith( '.py' ) ) return 'fa-file-code';
    if ( name.endsWith( '.html' ) ) return 'fa-file-code';
    if ( name.endsWith( '.css' ) ) return 'fa-file-code';
    return 'fa-file';
}

function guessLanguage( name ) {
    if ( name.endsWith( '.js' ) ) return 'javascript';
    if ( name.endsWith( '.py' ) ) return 'python';
    if ( name.endsWith( '.html' ) ) return 'html';
    if ( name.endsWith( '.css' ) ) return 'css';
    if ( name.endsWith( '.java' ) ) return 'java';
    if ( name.endsWith( '.cpp' ) || name.endsWith( '.c' ) ) return 'cpp';
    return 'javascript';
}

export function initCodeCollab( socket, room, username, getMySocketId ) {
    trace( 'code', 'initCodeCollab:start', { room, username } );

    const pane = document.getElementById( 'peer-code-pane' );
    const editorHost = document.getElementById( 'peer-code-editor' );
    const langSelect = document.getElementById( 'code-language' );
    const statusEl = document.getElementById( 'code-collab-status' );
    const filesListEl = document.getElementById( 'studio-files-list' );
    const editorTabsEl = document.getElementById( 'editor-tabs' );

    if ( !pane || !editorHost || typeof CodeMirror === 'undefined' ) {
        warn( 'code', 'init skipped', { pane: !!pane, editorHost: !!editorHost, codeMirror: typeof CodeMirror } );
        return null;
    }

    // ── State ─────────────────────────────────────────────────────────────────
    let files = [];           // [{id, name, language, content}]
    let activeFileId = null;
    let editor = null;
    let applyingRemote = false;
    let emitTimer = null;

    function setStatus( text ) {
        if ( statusEl ) statusEl.textContent = text;
    }

    // ── Editor ────────────────────────────────────────────────────────────────
    function ensureEditor() {
        if ( editor ) return editor;

        // Use whatever theme was chosen before the editor initialised
        const initialTheme = ( window.__getEditorTheme && window.__getEditorTheme() ) || 'dracula';

        editor = CodeMirror.fromTextArea( editorHost, {
            lineNumbers: true,
            theme: initialTheme,
            mode: 'javascript',
            tabSize: 2,
            indentUnit: 2,
            lineWrapping: true,
            extraKeys: {
                'Ctrl-Enter': () => document.getElementById( 'run-code-btn' )?.click(),
                'Cmd-Enter': () => document.getElementById( 'run-code-btn' )?.click(),
            },
        } );

        // Expose setter so the toggle button (non-module script) can reach it
        window.__setEditorTheme = ( theme ) => {
            if ( editor ) editor.setOption( 'theme', theme );
        };

        // Replay any theme change that arrived before the editor was ready
        if ( window.__getEditorTheme ) {
            window.__setEditorTheme( window.__getEditorTheme() );
        }

        editor.on( 'change', () => {
            if ( applyingRemote || !editor || !activeFileId ) return;
            const f = files.find( ( x ) => x.id === activeFileId );
            if ( f ) f.content = editor.getValue();
            scheduleEmit();
        } );

        editor.on( 'cursorActivity', () => {
            if ( applyingRemote || !editor || !activeFileId ) return;
            const pos = editor.getCursor();
            socket.emit( 'code:cursor', { room, sender: username, fileId: activeFileId, line: pos.line, ch: pos.ch } );
        } );

        requestAnimationFrame( () => { editor.refresh(); editor.focus(); } );
        return editor;
    }

    function scheduleEmit() {
        clearTimeout( emitTimer );
        emitTimer = setTimeout( () => {
            const f = files.find( ( x ) => x.id === activeFileId );
            if ( !f ) return;
            const payload = {
                room,
                fileId: f.id,
                code: f.content,
                language: f.language,
                sender: username,
                senderId: getMySocketId ? getMySocketId() : null,
            };
            trace( 'code', 'emit file:update', { fileId: f.id, bytes: f.content.length } );
            socket.emit( 'file:update', payload );
            setStatus( 'Saved to session' );
        }, 280 );
    }

    function setLanguage( lang ) {
        if ( !editor ) return;
        editor.setOption( 'mode', MODES[lang] || 'javascript' );
        if ( langSelect ) langSelect.value = lang;
    }

    // ── File switching ────────────────────────────────────────────────────────
    function switchToFile( fileId ) {
        const f = files.find( ( x ) => x.id === fileId );
        if ( !f ) return;
        activeFileId = fileId;

        ensureEditor();
        applyingRemote = true;
        editor.setValue( f.content || '' );
        setLanguage( f.language || 'javascript' );
        applyingRemote = false;

        editor.clearHistory();
        requestAnimationFrame( () => { editor.refresh(); editor.focus(); } );

        renderSidebar();
        renderTabs();
        setStatus( 'Live collaboration on' );
    }

    // ── Sidebar ───────────────────────────────────────────────────────────────
    function renderSidebar() {
        if ( !filesListEl ) return;
        filesListEl.innerHTML = '';
        files.forEach( ( f ) => {
            const div = document.createElement( 'div' );
            div.className = 'studio-explorer__file' + ( f.id === activeFileId ? ' studio-explorer__file--active' : '' );
            div.dataset.fileId = f.id;
            div.innerHTML = `
                <i class="fa ${ fileIcon( f.name ) }"></i>
                <span class="file-name-label">${ f.name }</span>
                ${ files.length > 1 ? `<button class="file-delete-btn" title="Delete file" data-file-id="${ f.id }">×</button>` : '' }
            `;
            div.addEventListener( 'click', ( e ) => {
                if ( e.target.closest( '.file-delete-btn' ) ) return;
                switchToFile( f.id );
            } );
            const delBtn = div.querySelector( '.file-delete-btn' );
            if ( delBtn ) {
                delBtn.addEventListener( 'click', ( e ) => {
                    e.stopPropagation();
                    deleteFile( f.id );
                } );
            }
            filesListEl.appendChild( div );
        } );
    }

    function renderTabs() {
        if ( !editorTabsEl ) return;
        editorTabsEl.innerHTML = '';
        files.forEach( ( f ) => {
            const span = document.createElement( 'span' );
            span.className = 'studio-tab' + ( f.id === activeFileId ? ' studio-tab--active' : '' );
            span.textContent = f.name;
            span.addEventListener( 'click', () => switchToFile( f.id ) );
            editorTabsEl.appendChild( span );
        } );
    }

    // ── File CRUD ─────────────────────────────────────────────────────────────
    async function addNewFile() {
        const trimmed = await showPrompt( {
            title: 'New file',
            message: 'Choose a name for the new file in this session.',
            placeholder: 'helper.js',
            confirmLabel: 'Add file',
        } );
        if ( !trimmed ) return;
        const id = 'f_' + Date.now();
        const lang = guessLanguage( trimmed );
        const file = { id, name: trimmed, language: lang, content: '' };
        files.push( file );
        socket.emit( 'file:create', { room, file } );
        switchToFile( id );
    }

    async function deleteFile( fileId ) {
        if ( files.length <= 1 ) return;
        const file = files.find( ( x ) => x.id === fileId );
        const ok = await showConfirm( {
            title: 'Delete file?',
            message: file
                ? `"${ file.name }" will be removed for everyone in this room. This cannot be undone.`
                : 'This file will be removed for everyone in this room. This cannot be undone.',
            confirmLabel: 'Delete file',
            cancelLabel: 'Keep file',
            variant: 'danger',
        } );
        if ( !ok ) return;
        files = files.filter( ( x ) => x.id !== fileId );
        socket.emit( 'file:delete', { room, fileId } );
        if ( activeFileId === fileId ) {
            switchToFile( files[0].id );
        } else {
            renderSidebar();
            renderTabs();
        }
    }

    // ── Socket handlers ───────────────────────────────────────────────────────
    socket.on( 'code:state', ( data ) => {
        trace( 'code', 'socket code:state', data );
        // data = { files: [...] }
        if ( Array.isArray( data?.files ) ) {
            files = data.files;
        } else if ( data?.code !== undefined ) {
            // legacy single-file state
            files = [ { id: 'f1', name: 'solution.js', language: data.language || 'javascript', content: data.code || '' } ];
        }
        if ( !files.length ) return;
        switchToFile( files[0].id );
    } );

    socket.on( 'file:update', ( data ) => {
        const myId = getMySocketId ? getMySocketId() : null;
        if ( myId && data.senderId && data.senderId === myId ) return;

        const f = files.find( ( x ) => x.id === data.fileId );
        if ( f ) {
            f.content = data.code || '';
            if ( data.language ) f.language = data.language;

            if ( data.fileId === activeFileId && editor ) {
                const cur = editor.getCursor();
                applyingRemote = true;
                editor.setValue( f.content );
                setLanguage( f.language );
                editor.setCursor( cur );
                applyingRemote = false;
                setStatus( data.sender ? `Synced · ${ data.sender }` : 'Synced' );
                window.peerStudioUi?.logActivity(
                    data.sender ? `<strong>${ data.sender }</strong> edited ${ f.name }` : 'Editor synced'
                );
            }
        }
    } );

    socket.on( 'file:create', ( data ) => {
        if ( data?.file && !files.find( ( x ) => x.id === data.file.id ) ) {
            files.push( { ...data.file, content: data.file.content || '' } );
            renderSidebar();
            renderTabs();
        }
    } );

    socket.on( 'file:delete', ( data ) => {
        if ( !data?.fileId ) return;
        files = files.filter( ( x ) => x.id !== data.fileId );
        if ( activeFileId === data.fileId && files.length > 0 ) {
            switchToFile( files[0].id );
        } else {
            renderSidebar();
            renderTabs();
        }
    } );

    socket.on( 'file:rename', ( data ) => {
        const f = files.find( ( x ) => x.id === data.fileId );
        if ( f ) {
            f.name = data.name;
            renderSidebar();
            renderTabs();
        }
    } );

    socket.on( 'code:cursor', ( data ) => {
        if ( !data || data.sender === username || !editor ) return;
        setStatus( `${ data.sender } is editing…` );
    } );

    // Language selector
    if ( langSelect ) {
        langSelect.addEventListener( 'change', () => {
            const f = files.find( ( x ) => x.id === activeFileId );
            if ( f ) {
                f.language = langSelect.value;
                setLanguage( langSelect.value );
                scheduleEmit();
            }
        } );
    }

    // Add-file button
    document.getElementById( 'add-file-btn' )?.addEventListener( 'click', addNewFile );

    setStatus( 'Connecting…' );
    requestAnimationFrame( () => ensureEditor() );

    return {
        get editor() { return ensureEditor(); },
        show() { ensureEditor(); setStatus( 'Live collaboration on' ); },
        hide() {},
        toggle() {},
        getValue() { return ensureEditor().getValue(); },
        getCurrentFileId() { return activeFileId; },
    };
}
