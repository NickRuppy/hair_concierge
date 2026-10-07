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
  if(id.endsWith('/wistia-video'))return {WistiaVideo:()=>e('div',{className:'source-video'},e('iframe',{src:'https://fast.wistia.net/embed/iframe/nwrpfub965',title:'Bestehendes Video zum Haarplan',allowFullScreen:true}))};
  if(id.includes('/regular-quiz-field-test/')||id.includes('/partner-access/')||id.endsWith('/before-after-figure'))return new Proxy({},{get:()=>()=>null});
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

const ANSWERS={structure:'wavy',thickness:'fine',density:'medium',hair_length:'long',fingertest:'leicht_uneben',pulltest:'stretches_stays',scalp_type:'trocken',has_scalp_issue:false,concerns:['dryness','frizz'],treatment:['gefaerbt'],goals:['moisture','less_frizz']};
const nick=loader(NICK);
const full=render(e(nick('src/components/organic-plan-offer/organic-plan-offer.tsx').OrganicPlanOffer,{quizAnswers:ANSWERS,entryContext:'quiz_completion',leadId:null,offerVariant:'organic-plan-v1',pricingSlot:null}));
let opening=full.slice(0,full.lastIndexOf('<section',full.indexOf('data-offer-section="personal_plan_complete_plan"')));
if(!opening.includes('data-organic-diagnostic-row'))throw Error('Source diagnosis not rendered');
const fonts='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">';
const doc=(title,body)=>'<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title>'+fonts+'<link rel="stylesheet" href="result-draft-render.css"><link rel="stylesheet" href="result-draft.css"><link rel="stylesheet" href="scan-result-options.css"></head><body>'+body+'</body></html>';
fs.writeFileSync(path.join(out,'result-organic-source.html'),doc('Organische Auswertung · bestehende Vorlage',opening+'<p class="end-note">Ende des hier verglichenen Ausschnitts. Danach folgen die Plan-Vorteile und das Angebot.</p></main>'));
let draft=opening.replace('Deine Analyse ist bereit','Dein Ergebnis').replace('Dein Haarplan ist bereit.','Das ist dein Haarprofil.').replace('Angebot ansehen','Zum Scanner').replace('href="#pricing"','href="#scanner"').replace('Schau dir zuerst das Video an:','Was deine Antworten für deine Pflege bedeuten:');
draft=draft.replace(/<p[^>]*>Was deine Antworten für deine Pflege bedeuten:<\/p>/,'').replace(/<div class="source-video">[\s\S]*?<\/div>/,'');
draft=draft.replace('In deinem Haar steckt viel Potenzial.','Deine Ausgangslage').replace(/<p[^>]*>Deine Ausgangslage<\/p>/,'').replace(/<p[^>]*>Deine Antworten zeigen, wie wir deine Ausgangslage einordnen.<\/p>/,'');
draft=draft.replace('href="#scanner"','href="#pricing"').replace('Zum Scanner','Angebot ansehen');
draft=draft.replace('Hier können wir gezielt ansetzen.','Dein Haarprofil steht.').replace('Dein Plan baut genau auf diesen Punkten auf.','Jetzt kann der Scanner Produkte damit abgleichen.').replace('Das Gute','Dein nächster Schritt');
draft=draft.replace(/<div class="mt-4 rounded-\[1\.25rem\] border border-emerald-100[\s\S]*?<\/div>/,'');
const bridge=fs.readFileSync(path.join(out,'result-scanner-sections.html'),'utf8');
fs.writeFileSync(path.join(out,'result-scanner-draft.html'),doc('Scanner · Ergebnis und Angebot',draft+bridge+'</main>').replace('<body>','<body class="scanner-current-draft">').replace('</head>','<link rel="stylesheet" href="scanner-mobile-polish.css"></head>'));
(async()=>{const postcss=req('postcss'),tw=req('@tailwindcss/postcss');let css=source(NICK,'src/app/globals.css').toString().replace('@import "tailwindcss";',`@import "${path.join(primary,'node_modules/tailwindcss/index.css')}" source(none);\n@source "${out}";`);const built=await postcss([tw({base:out})]).process(css,{from:path.join(primary,'src/app/globals.css')});fs.writeFileSync(path.join(out,'result-draft-render.css'),built.css);fs.writeFileSync(path.join(out,'result-draft-source.json'),JSON.stringify({source:NICK,sourceComponent:'src/components/organic-plan-offer/organic-plan-offer.tsx',answers:ANSWERS,retained:'Source layout, profile line, DiagnosticRow markup and existing assessment-generated row copy and scores.',proposed:'Jonas order: profile, source diagnostic cards, dark bridge, scanner and result examples, original Steffi video directly above trial pricing, then four source app-benefit cards. Floating WhatsApp preview.',video:'Existing local Steffi scanner asset is provisional; final result-explainer content not approved. Reference retains organic Wistia video.',scope:'Mobile-first local draft. Trial amounts from separate plan revision 1.6; day-five reminder/timeline newly requested by Nick, delivery implementation still pending. Checkout and WhatsApp are local review dialogs. Genuine OGX result screenshot captured from production using the existing authorized scanner test account; separate example profile. No live actions or final journey sign-off.'},null,2));console.log('Rendered organic source and scanner draft at '+NICK)})().catch(e=>{console.error(e);process.exitCode=1});
