// maps/dropdownMap.js
module.exports = {
  // Swiss stage prediction
  // legacy (colon ids)
  'swiss_3_0:': 'submitSwissDropdown',
  'swiss_0_3:': 'submitSwissDropdown',
  'swiss_advancing:': 'submitSwissDropdown',

  // new (underscore ids)
  'swiss_3_0_stage1': 'submitSwissDropdown',
  'swiss_0_3_stage1': 'submitSwissDropdown',
  'swiss_advancing_stage1': 'submitSwissDropdown',
  'swiss_3_0_stage2': 'submitSwissDropdown',
  'swiss_0_3_stage2': 'submitSwissDropdown',
  'swiss_advancing_stage2': 'submitSwissDropdown',
  'swiss_3_0_stage3': 'submitSwissDropdown',
  'swiss_0_3_stage3': 'submitSwissDropdown',
  'swiss_advancing_stage3': 'submitSwissDropdown',

  // Playoffs prediction
  'playoffs_semifinalists': 'submitPlayoffsDropdown',
  'playoffs_finalists': 'submitPlayoffsDropdown',
  'playoffs_winner': 'submitPlayoffsDropdown',
  'playoffs_third_place': 'submitPlayoffsDropdown',
  'playoffs_confirm': 'submitPlayoffsDropdown',

  // Swiss results
  // legacy (colon ids)
  'official_swiss_3_0:': 'submitSwissResultsDropdown',
  'official_swiss_0_3:': 'submitSwissResultsDropdown',
  'official_swiss_advancing:': 'submitSwissResultsDropdown',

  // baseId (router utnie _p0/_p1 do tego)
  'official_swiss_3_0_stage1': 'submitSwissResultsDropdown',
  'official_swiss_0_3_stage1': 'submitSwissResultsDropdown',
  'official_swiss_advancing_stage1': 'submitSwissResultsDropdown',
  'official_swiss_3_0_stage2': 'submitSwissResultsDropdown',
  'official_swiss_0_3_stage2': 'submitSwissResultsDropdown',
  'official_swiss_advancing_stage2': 'submitSwissResultsDropdown',
  'official_swiss_3_0_stage3': 'submitSwissResultsDropdown',
  'official_swiss_0_3_stage3': 'submitSwissResultsDropdown',
  'official_swiss_advancing_stage3': 'submitSwissResultsDropdown',

  // Playoffs results
  'results_playoffs_semifinalists': 'submitPlayoffsResultsDropdown',
  'results_playoffs_finalists': 'submitPlayoffsResultsDropdown',
  'results_playoffs_winner': 'submitPlayoffsResultsDropdown',
  'results_playoffs_third_place_winner': 'submitPlayoffsResultsDropdown',

  // Double Elim prediction
  'doubleelim_upper_final_a': 'submitDoubleElimDropdown',
  'doubleelim_lower_final_a': 'submitDoubleElimDropdown',
  'doubleelim_upper_final_b': 'submitDoubleElimDropdown',
  'doubleelim_lower_final_b': 'submitDoubleElimDropdown',

  // Double Elim results
  'official_doubleelim_upper_final_a': 'submitDoubleElimResultsDropdown',
  'official_doubleelim_lower_final_a': 'submitDoubleElimResultsDropdown',
  'official_doubleelim_upper_final_b': 'submitDoubleElimResultsDropdown',
  'official_doubleelim_lower_final_b': 'submitDoubleElimResultsDropdown',
  'open_doubleelim_results': 'openDoubleElimResultsDropdown',

  // Play-In
  'playin_qualified': 'submitPlayinDropdown',
  'official_playin_teams': 'submitPlayinResultsDropdown',
  'archive_file_select': 'submitArchiveDropdown',

  // MATCHES admin
  'match_admin_phase_select': 'matchAdminPhaseSelect',
  'match_admin_match_select': 'matchAdminMatchSelect',
  'match_admin_result_select': 'matchAdminResultSelect',
};
