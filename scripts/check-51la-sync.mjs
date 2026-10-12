import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { syncCompletedForDay } from './sync-51la.mjs';

// This preflight reads only the public snapshot, never the source API/Secrets.
// A successful cache that was not deployed must not suppress deployment.
export async function shouldRunDeployment({ scheduled = false, fetchImpl = fetch, now = new Date() } = {}) {
  if (!scheduled) return true;
  try {
    const response = await fetchImpl(`https://xijunlee.github.io/visitor-data.json?check=${now.getTime()}`, {
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (response.ok && syncCompletedForDay(await response.json(), now)) return false;
  } catch {}
  // Missing, invalid, stale or unreachable data: allow the build to recover
  // from its cache or retry the source; never invent a successful sync.
  return true;
}

async function main() {
  const scheduled = process.env.LA_SCHEDULED === 'true';
  const shouldRun = await shouldRunDeployment({ scheduled });
  console.log(!scheduled
    ? '51LA: manual run or code update; deployment allowed.'
    : shouldRun
      ? '51LA: daily published sync incomplete or unavailable; sync/deployment allowed.'
      : '51LA: daily data already synchronized and published; scheduled build/deployment skipped.');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `should_run=${shouldRun}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(() => {
  console.error('51LA: cannot write the deployment decision');
  process.exitCode = 1;
});
