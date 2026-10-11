/** Sites packaging fallback for environments without the plugin's installed source helper.
 * Credentials arrive through hidden stdin and are used only in child-process memory.
 * The user's GitHub checkout and remote are never modified.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, symlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const source = process.cwd();
if (process.stdin.isTTY) process.stdin.setRawMode(true);
process.stdout.write('Ready for Sites packaging JSON on stdin (input is hidden).\n');
const input = await new Promise((resolve,reject) => {
 let buffer='';
 process.stdin.setEncoding('utf8');
 process.stdin.on('data',chunk=>{buffer+=chunk;if(buffer.includes('\n')||buffer.includes('\r')){try{resolve(JSON.parse(buffer.trim()));}catch(e){reject(e);}process.stdin.pause();}});
 process.stdin.resume();
});
if (process.stdin.isTTY) process.stdin.setRawMode(false);
const credential = input.credential;
let token = credential?.token;
try {
 const manifest=JSON.parse(readFileSync(join(source,'.openai/hosting.json'),'utf8'));
 if(manifest.project_id!==input.project_id)throw new Error('Site identity mismatch.');
 if(!credential?.remote_url || !token || credential.auth_mode!=='http_extra_header')throw new Error('Unsupported or missing Sites credential.');
 const workspace=mkdtempSync(join(tmpdir(),'battlefield-site-'));
 const authEnv={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.extraHeader',GIT_CONFIG_VALUE_0:`Authorization: Bearer ${token}`,GIT_TERMINAL_PROMPT:'0'};
 const run=(command,args,cwd,env=process.env)=>{const result=spawnSync(command,args,{cwd,env,encoding:'utf8',maxBuffer:10*1024*1024});if(result.status!==0)throw new Error(`${command} failed: ${result.stderr || result.stdout}`);return result.stdout.trim();};
 run('git',['clone',credential.remote_url,workspace],source,authEnv);
 const excluded=new Set(['.git','node_modules','dist','.env','.env.local']);
 for(const name of readdirSync(source))if(!excluded.has(name)&&!name.endsWith('.tsbuildinfo'))cpSync(join(source,name),join(workspace,name),{recursive:true});
 symlinkSync(join(source,'node_modules'),join(workspace,'node_modules'),'dir');
 run('npm',['run','build'],workspace);
 run('git',['add','--all'],workspace);
 run('git',['-c','user.name=Codex','-c','user.email=codex@openai.com','commit','-m','Build Battlefield product discovery community'],workspace);
 const sha=run('git',['rev-parse','HEAD'],workspace);
 run('git',['push','origin',`HEAD:${credential.branch}`],workspace,authEnv);
 if(!existsSync(join(workspace,'dist/index.html')))throw new Error('Static output is missing.');
 const archive=join(tmpdir(),'battlefield-deployment.tar.gz');
 run('tar',['-czf',archive,'-C',workspace,'.openai/hosting.json','dist'],workspace);
 process.stdout.write(JSON.stringify({project_id:manifest.project_id,commit_sha:sha,archive,checkout_path:workspace})+'\n');
 token=null;
} catch(error){process.stderr.write(String(error.message).replaceAll(token||'UNSET','[REDACTED]')+'\n');process.exitCode=1;}
