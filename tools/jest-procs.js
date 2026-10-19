// AGENTS.md rule 10: list Jest and mongodb-memory-server processes; --kill-orphans kills the ones whose parent is gone.
// Never kills a live run: another agent may own it.
// Usage: node ~/agent-kit/tools/jest-procs.js [--kill-orphans]
const { execFileSync } = require('child_process');

if (process.platform !== 'win32') { console.error('jest-procs.js reads Win32_Process, so it only runs on Windows.'); process.exit(1); }
const query = `Get-CimInstance Win32_Process | ? { $_.ProcessId -ne ${process.pid} -and ($_.Name -eq 'mongod.exe' -or ($_.Name -eq 'node.exe' -and $_.CommandLine -match 'jest|mongodb-memory-server')) } | `
  + '% { [pscustomobject]@{ pid = $_.ProcessId; parent = $_.ParentProcessId; orphan = -not (Get-Process -Id $_.ParentProcessId -EA SilentlyContinue); cmd = $_.CommandLine } } | ConvertTo-Json -Compress';
const raw = execFileSync('powershell', ['-NoProfile', '-Command', query], { encoding: 'utf8' }).trim();
const procs = raw ? [].concat(JSON.parse(raw)) : [];

if (!procs.length) console.log('no Jest or mongod processes');
for (const p of procs) console.log(`${p.pid}\tparent ${p.parent}\t${p.orphan ? 'ORPHAN' : 'live'}\t${(p.cmd || '').slice(0, 160)}`);
if (process.argv.includes('--kill-orphans')) {
  for (const p of procs.filter((x) => x.orphan)) {
    console.log(`killing orphan ${p.pid}`);
    try { execFileSync('taskkill', ['/PID', String(p.pid), '/T', '/F'], { stdio: 'inherit' }); } catch { /* already gone */ }
  }
}
