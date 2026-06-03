/**
 * Upgrades window.cmDialog from dialogs-boot.js with full prompt support.
 */
import cmDialog, { showConfirm, showAlert, showPrompt } from './confirm-dialog.js';

window.cmDialog = cmDialog;
window.__cmDialogsReady = true;
window.dispatchEvent( new Event( 'cm-dialogs-ready' ) );

export { showConfirm, showAlert, showPrompt, cmDialog };
