// Static review artifact only. Uses pinned source; no application imports execute in browser.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const root=cp.execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const primary=root.split('/.worktrees/')[0];
const req=require('node:module').createRequire(path.join(primary,'package.json'));
const ts=req('typescript'),React=req('react'),{renderToStaticMarkup:render}=req('react-dom/server');
const out=__dirname,NICK='09799e227d36ce38103eaf04ebfe71248ab132fe',JONAS='d7de91a02a5435a031b233b27a7444bcd0592f1d';
const source=(ref,p)=>cp.execFileSync('git',['show',`${ref}:${p}`],{cwd:root,maxBuffer:30*1024*1024});
const e=React.createElement;
function loader(ref){const cache=new Map();return function load(p){
 if(cache.has(p))return cache.get(p).exports;
 let content;try{content=source(ref,p).toString()}catch{throw new Error('Missing '+p)}
 if(p.endsWith('.json'))return JSON.parse(content);
 const mod={exports:{}};cache.set(p,mod);
 function localRequire(id){
  if(id==='react')return React;
  if(id==='next/image')return {__esModule:true,default:({fill,priority,sizes,quality,unoptimized,...props})=>e('img',{...props,src:props.src.replace(/^\//,''),style:fill?{position:'absolute',inset:0,width:'100%',height:'100%',...props.style}:props.style})};
  if(id==='next/link')return {__esModule:true,default:({prefetch,replace,scroll,...props})=>e('a',props)};
  if(id==='next/navigation')return {notFound:()=>{throw Error('Unexpected notFound')}};
  if(id==='server-only')return {};
  if(id.endsWith('/ui/info-tip'))return {InfoTip:({label,body})=>e('button',{'aria-label':label,'data-info':body,className:'info-tip-preview',type:'button'},'i')};
  if(id.endsWith('/organic-plan-offer'))return {OrganicPlanOffer:()=>null};
  if(id.endsWith('/offer-tracking-provider'))return {OfferTrackingProvider:({children})=>e(React.Fragment,null,children)};
  if(id.endsWith('/quiz-browser-history'))return {useQuizBrowserBack:()=>()=>{}};
  if(id.endsWith('/quiz/store'))return {useQuizStore:fn=>{const state={goNext:()=>{},setAnswer:()=>{},answers:ANSWERS,funnelPackageKey:'scan_v1'};return fn?fn(state):state}};
  if(id.endsWith('/track-app-event'))return {trackAppEvent:()=>{}};
  if(id.endsWith('/quiz-mobile-bottom-action'))return {QuizMobileBottomAction:({children,className})=>e('div',{className},children),QuizMobileBottomClearance:()=>null};
  if(id.endsWith('/ui/button'))return {Button:({variant,asChild,...props})=>e('button',{...props,className:(props.className||'')+(variant==='cta'?' bg-[var(--brand-coral)] text-white rounded-xl flex items-center justify-center':'')})};
  if(id.startsWith('@/')||id.startsWith('.')){
   let resolved=id.startsWith('@/')?'src/'+id.slice(2):path.posix.normalize(path.posix.join(path.posix.dirname(p),id));
   const tree=cp.execFileSync('git',['ls-tree','-r','--name-only',ref,'--',resolved,resolved+'.ts',resolved+'.tsx',resolved+'.json'],{cwd:root,encoding:'utf8'}).trim().split('\n');
   const candidate=[resolved,resolved+'.ts',resolved+'.tsx',resolved+'.json',resolved+'/index.ts',resolved+'/index.tsx'].find(q=>tree.includes(q));
   if(!candidate)throw new Error('Unresolved '+id+' from '+p);return load(candidate);
  }
  return req(id);
 }
 const js=ts.transpileModule(content,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const fn=vm.runInThisContext(`(function(require,module,exports,process){${js}\n})`,{filename:p});fn(localRequire,mod,mod.exports,{env:{NODE_ENV:'development'}});return mod.exports;
}}

const ANSWERS={structure:"wavy"};const nick=loader(NICK);
const first=nick('src/lib/quiz/questions.ts').quizQuestions[1];
const question=render(e(nick('src/components/quiz/quiz-question.tsx').QuizQuestion,{question:first}));
const fonts='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">';
const intro='';
const html='<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nick · Quizfortschritt</title>'+fonts+'<link rel="stylesheet" href="quiz-progress-render.css"><link rel="stylesheet" href="frame.css"><link rel="stylesheet" href="quiz-entry.css"><style>#question button[aria-label="Zurück"]{display:flex}.quiz-entry{padding-top:18px}</style></head><body><main class="quiz-entry">'+intro+'<section id="question" aria-label="Haardicke-Frage">'+question+'</section><p class="answer-hint">Tippe auf eine Antwort, um weiterzumachen.</p></main><aside id="entry-notice" role="status" hidden></aside><script src="quiz-entry.js"></script></body></html>';
fs.writeFileSync(path.join(out,'quiz-progress-current.html'),html);
const assets=new Set([...question.matchAll(/src="((?:images)\/[^"?]+)"/g)].map(m=>m[1]));
for(const a of assets){const dest=path.join(out,a);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,source(NICK,'public/'+a));}
(async()=>{const postcss=req('postcss'),tw=req('@tailwindcss/postcss');let css=source(NICK,'src/app/globals.css').toString().replace('@import "tailwindcss";',`@import "${path.join(primary,'node_modules/tailwindcss/index.css')}" source(none);\n@source "${out}";`);const built=await postcss([tw({base:out})]).process(css,{from:path.join(primary,'src/app/globals.css')});fs.writeFileSync(path.join(out,'quiz-progress-render.css'),built.css);fs.writeFileSync(path.join(out,'quiz-progress-source.json'),JSON.stringify({source:NICK,questionStep:first.step,questionNumber:first.questionNumber,assets:[...assets],adapters:['prior structure answer: wavy','inactive navigation','native image tags','local info-tip button'],note:'Current second QuizQuestion component, without any new progress indicators. Static preview only.'},null,2));console.log('Rendered second question from '+NICK+', assets '+assets.size)})().catch(e=>{console.error(e);process.exitCode=1});
