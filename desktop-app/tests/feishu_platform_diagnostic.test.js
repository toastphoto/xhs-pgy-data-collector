const { test } = require('node:test');
const assert = require('node:assert/strict');
const { platformDiagnostic } = require('../lib/feishu_platform_diagnostic');
const field = { field_name: '\u5e73\u53f0', field_type_key: 'select' };
test('platform-only evidence keeps literal options without assuming their meaning', () => {
  const result = platformDiagnostic([{...field, options:[{label:'XHS',value:'001',secret:'private', extra:{value:'private'}}]},
    {field_name:'Contact',field_type_key:'text',default_value:'private'}]);
  assert.equal(result.options[0].value,'001');
  assert.equal(result.options[0].label,'XHS');
  assert.equal(JSON.stringify(result).includes('private'),false);
});
test('missing and ambiguous option metadata remains unresolved', () => {
  assert.equal(platformDiagnostic([]).status,'ambiguous_field');
  assert.equal(platformDiagnostic([field,field]).status,'ambiguous_field');
  assert.equal(platformDiagnostic([field]).status,'options_absent');
  assert.equal(platformDiagnostic([{...field,options:Array(501).fill({})}]).status,'options_too_large');
});
test('unsafe strings and nested values are not copied', () => {
  const result=platformDiagnostic([{...field, options:[{label:'bad\n',value:{secret:'private'},id:0}]}]);
  assert.equal(result.options[0].label,undefined);
  assert.equal(result.options[0].value,undefined);
  assert.equal(result.options[0].id,0);
});
