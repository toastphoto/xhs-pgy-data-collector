const { runContactProbe } = require('../lib/feishu_contact_workflow');

async function main() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString('utf8');
    if (Buffer.byteLength(input) > 32768) throw new Error('INPUT_INVALID');
  }
  const config = JSON.parse(input);
  input = '';
  const result = await runContactProbe(config);
  // Private preview travels only to the local parent window; never save stdout to a log.
  process.stdout.write(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
main().catch(() => {
  process.stdout.write(JSON.stringify({ ok: false, code: 'FEISHU_PROBE_INPUT_INVALID' }));
  process.exitCode = 1;
});
