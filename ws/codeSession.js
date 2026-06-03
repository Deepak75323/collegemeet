const MAX_CODE_LENGTH = 500000;

const DEFAULT_CODE = `// Peer coding — both of you can edit this file in real time
function greet(name) {
  return 'Hello, ' + name + '!';
}

console.log(greet('Collegemeet'));
`;

const sessions = new Map();

function makeDefault() {
    return {
        files: [
            { id: 'f1', name: 'solution.js', language: 'javascript', content: DEFAULT_CODE },
            { id: 'f2', name: 'notes.md', language: 'javascript', content: '' },
        ],
    };
}

function getSession( room ) {
    if ( !sessions.has( room ) ) {
        sessions.set( room, makeDefault() );
    }
    return JSON.parse( JSON.stringify( sessions.get( room ) ) );
}

function updateFile( room, { fileId, code, language } ) {
    const s = sessions.get( room ) || makeDefault();
    const f = s.files.find( ( x ) => x.id === fileId );
    if ( f ) {
        if ( typeof code === 'string' ) f.content = code.slice( 0, MAX_CODE_LENGTH );
        if ( language ) f.language = language;
    }
    sessions.set( room, s );
    return JSON.parse( JSON.stringify( s ) );
}

function addFile( room, file ) {
    const s = sessions.get( room ) || makeDefault();
    if ( !s.files.find( ( x ) => x.id === file.id ) ) {
        s.files.push( { id: file.id, name: file.name, language: file.language || 'javascript', content: '' } );
    }
    sessions.set( room, s );
    return JSON.parse( JSON.stringify( s ) );
}

function removeFile( room, fileId ) {
    const s = sessions.get( room ) || makeDefault();
    if ( s.files.length <= 1 ) return JSON.parse( JSON.stringify( s ) );
    s.files = s.files.filter( ( x ) => x.id !== fileId );
    sessions.set( room, s );
    return JSON.parse( JSON.stringify( s ) );
}

function renameFile( room, fileId, name ) {
    const s = sessions.get( room ) || makeDefault();
    const f = s.files.find( ( x ) => x.id === fileId );
    if ( f ) f.name = name;
    sessions.set( room, s );
    return JSON.parse( JSON.stringify( s ) );
}

module.exports = { getSession, updateFile, addFile, removeFile, renameFile, DEFAULT_CODE };
