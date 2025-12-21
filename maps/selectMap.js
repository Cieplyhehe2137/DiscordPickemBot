// maps/selectMap.js
module.exports = {
  // start_pickem -> wybór fazy
  'select_pickem_phase': 'selectMenuHandler',

  'admin_select_swiss_stage': 'adminSwissStage',
  'select_swiss_results_stage': 'handleSelectSwissResultsStage',
   'restore_backup_select': 'restoreBackupSelector',
   // kliknięcie w dropdown z plikami archiwum -> wysyła wybrany .xlsx
   'archive_select': 'submitArchiveDropdown',

  // MATCHES (user prediction)
  'match_pick_select_pred': 'matchPickSelect',
  'match_score_select_pred': 'matchScoreSelect',

  // MATCHES (admin results)
  'match_admin_phase_select': 'matchAdminPhaseSelect',
  'match_pick_select_res': 'matchPickSelect',
  'match_score_select_res': 'matchScoreSelect'

};
