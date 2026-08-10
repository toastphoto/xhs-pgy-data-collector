import assert from 'node:assert/strict';
import {
  chooseCalibrationSelector,
  isCandidateCalibrationPassed
} from '../renderer/state/calibration_selector.mjs';

const pickedName = {
  selector: 'div.kol-info_detail:nth-of-type(2) > span.d-text:nth-of-type(1)',
  count: 1,
  fieldSelector: '.kol-name',
  fieldCount: 20,
  repeatSelector: 'div.kol-info_detail',
  repeatCount: 20
};

assert.equal(
  chooseCalibrationSelector({ key: 'candidate_name', repeatable: true }, pickedName),
  '.kol-name'
);
assert.equal(
  chooseCalibrationSelector({ key: 'candidate_row', repeatable: true }, pickedName),
  'div.kol-info_detail'
);
assert.equal(
  chooseCalibrationSelector({ key: 'note_card', repeatable: true }, pickedName),
  'div.kol-info_detail'
);
assert.equal(isCandidateCalibrationPassed({ ok: true, passed: false, rowCount: 20, nameCount: 20 }), false);
assert.equal(isCandidateCalibrationPassed({ ok: true, passed: true }), true);

console.log('calibration_selector.test.mjs OK');
