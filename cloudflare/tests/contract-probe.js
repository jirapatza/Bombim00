import { canonical, normalize, scheduleName, drawDate, numbers, fingerprint, scheduled, previousChannels, eligible } from '../src/domain.js';
process.stdin.setEncoding('utf8');
let input = ''; for await (const chunk of process.stdin) input += chunk;
const cases = JSON.parse(input);
process.stdout.write(JSON.stringify(cases.map(({ name, row, history, settings, catalog, today }) => ({
  canonical: canonical(name), normalize: normalize(name), scheduleName: scheduleName(name),
  date: drawDate(row), numbers: numbers(row), fingerprint: fingerprint(row),
  scheduled: scheduled(row, catalog, today), channels: previousChannels(row, history), eligible: eligible(settings, row),
}))));
