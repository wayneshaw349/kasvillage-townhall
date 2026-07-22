#!/usr/bin/env node
// Wires GenerateVaultScreen into AppNaviagator: union + import + reroute the
// "No seed found" case to the generator + render case. Count-guarded, CRLF-
// tolerant, idempotent, all-or-nothing.
// Usage:  node patch_wire_generate_vault.cjs [path\to\AppNaviagator.tsx]
const fs=require('fs');
const FILE=process.argv[2]||'AppNaviagator.tsx';
const EDITS=JSON.parse(Buffer.from('W3sibiI6MSwiZiI6IklDQjhJQ2QyWVhWc2RGOWlZV05yZFhBbkNpQWdmQ0FuZG1GMWJIUmZjbVZqYjNabGNua25Pd289IiwiciI6IklDQjhJQ2QyWVhWc2RGOWlZV05yZFhBbkNpQWdmQ0FuZG1GMWJIUmZjbVZqYjNabGNua25DaUFnZkNBbloyVnVaWEpoZEdWZmRtRjFiSFFuT3dvPSIsImQiOiJmQ0FuWjJWdVpYSmhkR1ZmZG1GMWJIUW4ifSx7Im4iOjIsImYiOiJhVzF3YjNKMElIc2dWbUYxYkhSU1pXTnZkbVZ5ZVZOamNtVmxiaUI5SUdaeWIyMGdKeTR2Vm1GMWJIUlNaV052ZG1WeWVWTmpjbVZsYmljN0NnPT0iLCJyIjoiYVcxd2IzSjBJSHNnVm1GMWJIUlNaV052ZG1WeWVWTmpjbVZsYmlCOUlHWnliMjBnSnk0dlZtRjFiSFJTWldOdmRtVnllVk5qY21WbGJpYzdDbWx0Y0c5eWRDQjdJRWRsYm1WeVlYUmxWbUYxYkhSVFkzSmxaVzRnZlNCbWNtOXRJQ2N1TDBkbGJtVnlZWFJsVm1GMWJIUlRZM0psWlc0bk93bz0iLCJkIjoiWm5KdmJTQW5MaTlIWlc1bGNtRjBaVlpoZFd4MFUyTnlaV1Z1Snc9PSJ9LHsibiI6MywiZiI6IklDQWdJQ0FnYVdZZ0tDRnRibVZ0YjI1cFl5a2dld29nSUNBZ0lDQWdJRUZzWlhKMExtRnNaWEowS0NkT2J5QnpaV1ZrSUdadmRXNWtKeXdnSjA1dklISmxZMjkyWlhKNUlIQm9jbUZ6WlNCemRHOXlaV1FnYjI0Z2RHaHBjeUJrWlhacFkyVWdkRzhnWW1GamF5QjFjQzRuS1RzS0lDQWdJQ0FnSUNCeVpYUjFjbTQ3Q2lBZ0lDQWdJSDBLIiwiciI6IklDQWdJQ0FnYVdZZ0tDRnRibVZ0YjI1cFl5a2dld29nSUNBZ0lDQWdJSE5sZEZOamNtVmxiaWduWjJWdVpYSmhkR1ZmZG1GMWJIUW5LVHNnTHk4Z2JtOGdjMlZsWkNCdmJpQjBhR2x6SUhkaGJHeGxkQ0F0UGlCdlptWmxjaUIwYnlCdGFXNTBJR0VnWW1GamEyRmliR1VnYjI1bENpQWdJQ0FnSUNBZ2NtVjBkWEp1T3dvZ0lDQWdJQ0I5Q2c9PSIsImQiOiJjMlYwVTJOeVpXVnVLQ2RuWlc1bGNtRjBaVjkyWVhWc2RDY3BPdz09In0seyJuIjo0LCJmIjoiSUNBZ0lHTmhjMlVnSjNaaGRXeDBYMkpoWTJ0MWNDYzZDaUFnSUNBZ0lISmxkSFZ5YmlBb0NpQWdJQ0FnSUNBZ1BGWmhkV3gwUW1GamEzVndVMk55WldWdUNnPT0iLCJyIjoiSUNBZ0lHTmhjMlVnSjJkbGJtVnlZWFJsWDNaaGRXeDBKem9LSUNBZ0lDQWdjbVYwZFhKdUlDZ0tJQ0FnSUNBZ0lDQThSMlZ1WlhKaGRHVldZWFZzZEZOamNtVmxiZ29nSUNBZ0lDQWdJQ0FnYm1WMGQyOXlhejE3YTJGemNHRkJaR1J5WlhOekxuTjBZWEowYzFkcGRHZ29KMnRoYzNCaGRHVnpkRG9uS1NBL0lDZDBaWE4wYm1WMExURXdKeUE2SUNkdFlXbHVibVYwSjMwS0lDQWdJQ0FnSUNBZ0lHOXVSRzl1WlQxN0tDa2dQVDRnYzJWMFUyTnlaV1Z1S0Nka1lYTm9ZbTloY21RbktYMEtJQ0FnSUNBZ0lDQWdJRzl1UTJGdVkyVnNQWHNvS1NBOVBpQnpaWFJUWTNKbFpXNG9KMlJoYzJoaWIyRnlaQ2NwZlFvZ0lDQWdJQ0FnSUM4K0NpQWdJQ0FnSUNrN0Nnb2dJQ0FnWTJGelpTQW5kbUYxYkhSZlltRmphM1Z3SnpvS0lDQWdJQ0FnY21WMGRYSnVJQ2dLSUNBZ0lDQWdJQ0E4Vm1GMWJIUkNZV05yZFhCVFkzSmxaVzRLIiwiZCI6IlkyRnpaU0FuWjJWdVpYSmhkR1ZmZG1GMWJIUW5PZz09In1d','base64').toString('utf8'));
const b64=x=>Buffer.from(x,'base64').toString('utf8');
const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\r?\n/g,'\r?\n');
let s=fs.readFileSync(FILE,'utf8');
const eol=s.includes('\r\n')?'\r\n':'\n';
let staged=s, applied=0, skipped=0;
for(const e of EDITS){
  const find=b64(e.f), repl=b64(e.r), done=b64(e.d);
  if(staged.includes(done)){console.log('[skip] edit '+e.n+' already applied.');skipped++;continue;}
  const re=new RegExp(esc(find),'g'); const c=(staged.match(re)||[]).length;
  if(c!==1){console.error('[ABORT] edit '+e.n+': anchor found '+c+' times (expected 1). No writes.');process.exit(1);}
  staged=staged.replace(new RegExp(esc(find)),repl.replace(/\r?\n/g,eol));
  console.log('[ok]   edit '+e.n+' staged.');applied++;
}
const markers=["| 'generate_vault'","from './GenerateVaultScreen'","setScreen('generate_vault');","case 'generate_vault':"];
const miss=markers.filter(m=>!staged.includes(m));
if(miss.length){console.error('[ABORT] post-condition: '+JSON.stringify(miss));process.exit(1);}
fs.writeFileSync(FILE,staged);
console.log('[done] '+applied+' applied, '+skipped+' skipped. Re-run: npx tsc --noEmit');
