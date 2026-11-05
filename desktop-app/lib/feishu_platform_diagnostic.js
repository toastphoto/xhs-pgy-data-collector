// Diagnostic evidence only: never interpret an option label as a query ID.
function platformDiagnostic(fields) {
  const matches = fields.filter(f => f.field_name === '\u5e73\u53f0' && f.field_type_key === 'select');
  if (matches.length !== 1) return { status: 'ambiguous_field' };
  const field = matches[0];
  const properties = Object.keys(field).filter(k => /^[A-Za-z0-9_]{1,64}$/.test(k)).sort();
  if (!Array.isArray(field.options)) return { status: 'options_absent', properties };
  if (field.options.length > 500) return { status: 'options_too_large', properties };
  const options = field.options.map(option => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return { shape: typeof option };
    const result = { properties: Object.keys(option).filter(k => /^[A-Za-z0-9_]{1,64}$/.test(k)).sort() };
    for (const name of ['label', 'value', 'key', 'id', 'name', 'option_key', 'option_name']) {
      const value = option[name];
      if (typeof value === 'string' && value.length <= 256 && !/[\x00-\x1f]/.test(value)) result[name] = value;
      else if (Number.isSafeInteger(value)) result[name] = value;
    }
    return result;
  });
  return { status: 'observed_options', properties, options };
}
module.exports = { platformDiagnostic };
