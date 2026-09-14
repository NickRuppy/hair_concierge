// Static review artifact only. Uses pinned source; no application imports execute in browser.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const root=cp.execFileSync('git',['rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
const primary=root.split('/.worktrees/')[0];
const req=require('node:module').createRequire(path.join(primary,'package.json'));
const ts=req('typescript'),React=req('react'),{renderToStaticMarkup:render}=req('react-dom/server');
const out=__dirname,NICK='5a3e33f1f641a8693209017ad25c4c9c69870df2',JONAS='d7de91a02a5435a031b233b27a7444bcd0592f1d';
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
  if(id.endsWith('/organic-plan-offer'))return {OrganicPlanOffer:()=>null};
  if(id.endsWith('/offer-tracking-provider'))return {OfferTrackingProvider:({children})=>e(React.Fragment,null,children)};
  if(id.endsWith('/quiz-browser-history'))return {useQuizBrowserBack:()=>()=>{}};
  if(id.endsWith('/quiz/store'))return {useQuizStore:fn=>fn({goNext:()=>{},answers:ANSWERS,funnelPackageKey:'scan_v1'})};
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
const nick=loader(NICK),jonas=loader(JONAS);
const plans=nick('src/components/checkout/subscription-plan-selector.tsx').SubscriptionPlanSelector;
const prices=nick('src/components/checkout/plan-reference-prices.ts');
const priceHTML={};for(const catalog of ['personal_plan_launch_v1','standard']){for(const interval of ['month','quarter','year'])priceHTML[catalog+':'+interval]=render(e(plans,{pricingCatalog:catalog,selectedInterval:interval,referencePrices:catalog==='standard'?prices.QUIZ_RESULT_REFERENCE_PRICES:prices.PERSONAL_PLAN_LAUNCH_REFERENCE_PRICES,onContinue:()=>{},onSelect:()=>{}}));}
const selector=e('div',null,e('div',{className:'preview-note'},'Gemeinsames Preismodul · statische Katalog-Vorschau'),e('select',{id:'catalog','aria-label':'Preiskatalog'},e('option',{value:'personal_plan_launch_v1'},'Launch-Katalog: 9,99 / 19,99 / 69,99 €'),e('option',{value:'standard'},'Standard-Katalog: 14,99 / 34,99 / 99,99 €')),e('div',{id:'price-module',dangerouslySetInnerHTML:{__html:priceHTML['personal_plan_launch_v1:quarter']}}));
const nickHTML=render(e(nick('src/components/scan-regal-offer/scan-regal-offer.tsx').ScanRegalOffer,{name:'Jonas',quizAnswers:ANSWERS,entryContext:'quiz_completion',leadId:null,offerVariant:'scan-regal-v1',pricingSlot:selector}));
const jonasHTML=render(e(jonas('src/app/labs/scanner-offer/page.tsx').default));
const nickQuiz=['problem','solution','home'].map((k,i)=>{const name={problem:'ScanInsertProblemView',solution:'ScanInsertSolutionView',home:'ScanInsertHomeView'}[k];return `<article class="quiz-preview" data-quiz-page="${i}" ${i?'hidden':''}>${render(e(nick(`src/components/quiz/scan-inserts/scan-insert-${k}.tsx`)[name],{answers:ANSWERS,funnelPackageKey:'scan_v1'}))}</article>`}).join('');
const quizNav='<nav class="quiz-nav"><button data-quiz-jump="0">1 · Problem</button><button data-quiz-jump="1">2 · Lösung</button><button data-quiz-jump="2">3 · Zu Hause</button></nav>';
const fonts='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">';
const head=(title)=>`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${fonts}<link rel="stylesheet" href="render.css"><link rel="stylesheet" href="frame.css"></head>`;
for(const [who,html]of [['nick',nickHTML],['jonas',jonasHTML]])fs.writeFileSync(path.join(out,who+'.html'),head(who==='nick'?'Nick · Scanner-Angebot':'Jonas · Scanner-Angebot')+`<body data-version="${who}"><div id="source-offer">${html}</div><section id="quiz-content" hidden>${who==='nick'?quizNav+nickQuiz:''}</section><section id="handover" hidden></section><aside id="preview-toast" role="status" hidden></aside><script src="pricing-data.js"></script><script src="frame.js"></script></body></html>`);
fs.writeFileSync(path.join(out,'pricing-data.js'),'window.PREVIEW_PRICES='+JSON.stringify(priceHTML)+';');
let originalQuiz=source(JONAS,'docs/scanner-offer/mockups/quiz-scanner-flow.html').toString();
originalQuiz=originalQuiz.replace('<style>','<style>')+`<style>.stage{padding:0;display:block}.stage>div:first-child{width:100%}.phone{border:0;border-radius:0;min-height:760px;box-shadow:none}.notes{display:none}.bar{display:none}.screen{min-height:720px;padding-top:22px}[hidden]{display:none!important}.review-quiz-nav{display:flex;gap:5px;overflow-x:auto;padding:10px;background:#f1edf5;position:sticky;top:0;z-index:10}.review-quiz-nav button{white-space:nowrap;border:1px solid #d7cce3;border-radius:20px;background:white;padding:8px 10px;color:#563882}</style><script>const reviewNav=document.createElement('nav');reviewNav.className='review-quiz-nav';['Landing','Dicke','Zugtest','Probescan','Produktzahl','E-Mail','Commitment','Reveal'].forEach((label,i)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>{go(i);window.scrollTo(0,0)};reviewNav.appendChild(b)});document.body.prepend(reviewNav);go(3);</script>`;
fs.writeFileSync(path.join(out,'jonas-quiz.html'),originalQuiz);
// Copy only assets referenced by static offer/quiz HTML, plus complete original quiz's local assets.
const assets=new Set([...nickHTML.matchAll(/(?:src|poster)="((?:images|videos)\/[^"?]+)"/g),...jonasHTML.matchAll(/(?:src|poster)="\/?((?:images|videos)\/[^"?]+)"/g),...nickQuiz.matchAll(/(?:src|poster)="((?:images|videos)\/[^"?]+)"/g)].map(m=>m[1]));
for(const a of assets){const ref=a.includes('scanner-offer')?JONAS:NICK;const dest=path.join(out,a);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,source(ref,'public/'+a));}
for(const a of ['photo-scanner-shelf.webp','device-scan-example.webp'])fs.writeFileSync(path.join(out,a),source(JONAS,'docs/scanner-offer/mockups/'+a));
// Fix source video/poster absolute paths for portable static serving.
for(const who of ['nick','jonas']){const p=path.join(out,who+'.html');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/(src|poster)="\/(images|videos)\//g,'$1="$2/'));}
(async()=>{
 const postcss=req('postcss'),tw=req('@tailwindcss/postcss');
 let css=source(NICK,'src/app/globals.css').toString().replace('@import "tailwindcss";',`@import "${path.join(primary,'node_modules/tailwindcss/index.css')}" source(none);\n@source "${out}";`);
 const built=await postcss([tw({base:out})]).process(css,{from:path.join(primary,'src/app/globals.css')});fs.writeFileSync(path.join(out,'render.css'),built.css);
 fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify({nick:NICK,jonas:JONAS,answers:ANSWERS,note:'Offer components rendered statically. Source hooks not hydrated; review-only navigation/plan changes supplied in frame.js. No tracking, payment, or network actions. Shared pricing catalog selectable, not verified production configuration.'},null,2));
 console.log('Rendered two exact offer trees, three Nick quiz inserts, Jonas original quiz; assets '+assets.size);
})().catch(e=>{console.error(e);process.exitCode=1});
