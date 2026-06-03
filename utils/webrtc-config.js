/**
 * Optional TURN server for WebRTC (video calls behind strict NAT/firewalls).
 * Set TURN_URLS, TURN_USERNAME, TURN_CREDENTIAL in .env
 */

function parseTurnUrls( raw ) {
    if ( !raw || !String( raw ).trim() ) {
        return null;
    }

    const trimmed = String( raw ).trim();

    if ( trimmed.startsWith( '[' ) ) {
        try {
            const parsed = JSON.parse( trimmed );
            return Array.isArray( parsed ) ? parsed.filter( Boolean ) : null;
        } catch {
            return null;
        }
    }

    return trimmed
        .split( ',' )
        .map( ( s ) => s.trim() )
        .filter( Boolean );
}

const PLACEHOLDER_PATTERNS = [
    /your\.server/i,
    /your_username/i,
    /your_credential/i,
    /example\.com/i,
];

function isPlaceholder( value ) {
    if ( !value ) return false;
    return PLACEHOLDER_PATTERNS.some( ( re ) => re.test( String( value ) ) );
}

function getClientTurnConfig() {
    const urls = parseTurnUrls( process.env.TURN_URLS );

    if ( !urls || !urls.length ) {
        return null;
    }

    if ( isPlaceholder( process.env.TURN_URLS ) || isPlaceholder( process.env.TURN_USERNAME ) ) {
        console.warn( '[webrtc-config] TURN_URLS looks like a placeholder — ignoring TURN config. Set real TURN credentials in .env.' );
        return null;
    }

    const config = { urls };

    if ( process.env.TURN_USERNAME ) {
        config.username = process.env.TURN_USERNAME;
    }

    if ( process.env.TURN_CREDENTIAL ) {
        config.credential = process.env.TURN_CREDENTIAL;
    }

    return config;
}

module.exports = {
    getClientTurnConfig,
    parseTurnUrls,
};
