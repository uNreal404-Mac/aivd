// Source gate for a committed or working UI diff. Browser and external reviews remain separate.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const git = (...args) => execFileSync("git",args,{encoding:"utf8",maxBuffer:16*1024*1024});
const root = git("rev-parse","--show-toplevel").trim();
process.chdir(root);
const checks = [
  ["new-hex", /#[\da-f]{3,4}\b|#[\da-f]{6}(?:[\da-f]{2})?\b/i],
  ["literal-color", /(?:rgba?|hsla?|oklch)\(\s*[\d.]/i],
  ["gradient", /(?:repeating-)?(?:linear|radial|conic)-gradient\s*\(|\bbg-(?:gradient|linear|radial|conic)-/i],
  ["emoji-icon", /\p{Extended_Pictographic}/u],
  ["visible-raw-key", /(?:>|["'`])\s*(?:hd_videos|fast_generation|commercial_use)\s*(?:<|["'`])/],
  ["empty-loading-copy", /(?:>|["'`])\s*(?:loading\.{3}|loading…|暂无公开作品)\s*(?:<|["'`])/i],
  ["palette-declaration", /--du-[\w-]+\s*:/],
];
function scanLine(line) {return checks.filter(([,re])=>re.test(line)).map(([name])=>name);}
if(process.argv[2]==="--self-test"){
  for(const [line,rule] of [['color: #fff','new-hex'],['className="bg-gradient-to-r"','gradient'],['<i>🎬</i>','emoji-icon'],['<span>hd_videos</span>','visible-raw-key'],['<p>Loading...</p>','empty-loading-copy'],['--du-text: anything','palette-declaration']]){
    if(!scanLine(line).includes(rule))throw Error(rule);
  }
  if(scanLine('color:var(--du-text);').length)throw Error('token false positive');
  console.log("Source rules: positive and negative fixtures passed.");process.exit(0);
}
const base=process.argv[2];
if(!base || base.startsWith("-"))throw Error("Usage: node apps/video/scripts/audit-ui.cjs BASE [UI paths...]");
const sha=git("rev-parse","--verify",base+"^{commit}").trim();
const scopes=process.argv.slice(3); if(scopes.some(s=>path.isAbsolute(s)||s.split('/').includes('..')))throw Error('Provide repository-relative paths.');
const changed=new Set([...git('diff','--name-only','-z',sha,'--',...scopes).split('\0'),...git('ls-files','--others','--exclude-standard','-z','--',...scopes).split('\0')].filter(Boolean));
const findings=[];
for(const name of changed){
  const hit=(rule,line)=>findings.push({file:name,line,rule});
  if(/(?:^|\/)(?:\.env(?:\.|$)|\.dev\.vars|secrets?(?:\.|\/))|\/src\/(?:app\/api\/|(?:lib|services|config)\/(?:auth|billing|stripe|creem|credits|pricing-user)(?:[./-]|$))/.test(name)){hit('protected-path',0);continue;}
  if(!name.startsWith('apps/video/src/')||!/[.](?:[jt]sx?|css|json|svg)$/.test(name))continue;
  let diff=git('diff','--no-ext-diff','--unified=0',sha,'--',name);
  if(!diff && fs.existsSync(name))diff='@@ -0,0 +1 @@\n'+fs.readFileSync(name,'utf8').split('\n').map(l=>'+'+l).join('\n');
  let number=0;
  for(const line of diff.split('\n')){
    const match=line.match(/^@@ .*?\+(\d+)/); if(match){number=Number(match[1]);continue;}
    if(line.startsWith('+++')||!line.startsWith('+'))continue;
    for(const rule of scanLine(line.slice(1)))hit(rule,number);
    number++;
  }
}
// Detect actual JSX nesting, including nested cards split across multiple lines.
const jsx=[...changed].filter(n=>n.startsWith('apps/video/src/')&&/\.[jt]sx$/.test(n)&&fs.existsSync(n));
if(jsx.length){
  const ts=require(require.resolve('typescript',{paths:[path.join(root,'apps/video')]}));
  for(const name of jsx){
    const content=fs.readFileSync(name,'utf8'), source=ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    function visit(node,inside){
      const open=ts.isJsxElement(node)?node.openingElement:ts.isJsxSelfClosingElement(node)?node:null;
      const card=open && (open.tagName.getText(source).split('.').pop()==='Card' || open.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==='className'&&p.initializer&&/\b(?:du-card|pr-card|s\.card|styles\.card)\b/.test(p.initializer.getText(source))));
      if(card&&inside)findings.push({file:name,line:source.getLineAndCharacterOfPosition(open.getStart(source)).line+1,rule:'nested-card-in-changed-file'});
      ts.forEachChild(node,c=>visit(c,inside||card));
    }
    visit(source,false);
  }
}
console.log(JSON.stringify({base:sha,scopes,changed:[...changed],findings,sourceGate:findings.length?"needs-review":changed.size?"clean":"no-changes",remaining:"Rendered states, nested composed components, token area, SEO, guidelines, Lighthouse and external A require their own evidence."},null,2));
if(findings.length)process.exitCode=1;
