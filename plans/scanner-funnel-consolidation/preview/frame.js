const version=document.body.dataset.version;
const area=new URLSearchParams(location.search).get('area')||'opening';
document.body.dataset.area=area;
const source=document.querySelector('#source-offer');
const sections=[...source.querySelectorAll('[data-offer-section]')];
const toast=document.querySelector('#preview-toast');let toastTimer;
function notify(text){toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,3200)}
function onlySections(names){for(const el of sections)el.hidden=!names.includes(el.dataset.offerSection);const header=source.querySelector('header')||(version==='nick'?source.querySelector('.sticky'):null);if(header)header.hidden=true;source.querySelectorAll('footer').forEach(el=>el.hidden=true);source.querySelectorAll('.fixed').forEach(el=>el.hidden=true);const internal=source.querySelector('[data-offer-variant] > p');if(internal)internal.hidden=true;}
function note(text,at=source){const p=document.createElement('p');p.className='preview-note focus-note';p.textContent=text;at.append(p)}
if(area==='profile'){
 onlySections(version==='nick'?['scan_criteria']:['profile','diagnostic']);
 if(version==='nick'){const p=document.createElement('div');p.className='compact-profile';p.innerHTML='<span>Profilzeile aus dem Einstieg</span><p>Welliges, feines Haar mit mittlerer Dichte.</p>';source.prepend(p)}
}
if(area==='proof')onlySections(version==='nick'?['hero','product_tour']:['scanner-demo']);
if(area==='pricing')onlySections(['pricing']);
if(area==='unknown'){
 onlySections(['faq']);
 source.querySelectorAll('details').forEach(el=>{const text=el.querySelector('summary').textContent;const keep=version==='nick'?text.includes('Welche Produkte kennt'):text.includes('nicht erkannt');el.hidden=!keep;el.open=keep});
}
if(area==='footer'){
 onlySections(version==='nick'?['final_cta']:[]);
 if(version==='jonas')source.querySelector('footer').hidden=false;
 else note('Hier endet Nicks Angebotsseite. Ein gemeinsamer Footer mit Impressum, AGB und Widerruf ist an dieser Stelle nicht enthalten.');
}
if(area==='quiz'){
 if(version==='jonas')location.replace('jonas-quiz.html');
 source.hidden=true;document.querySelector('#quiz-content').hidden=false;
}
if(area==='handover'){
 source.hidden=true;const box=document.querySelector('#handover');box.hidden=false;box.className='preview-appendix';
 const entries=version==='nick'?[
 ['Testphase','7 Tage auf Monat und Jahr. Freischaltung nach bestätigter Zahlungsautorisierung.'],
 ['Monat','9,99 € nach der Testphase.'],['Jahr','69,99 € im ersten bezahlten Jahr, danach 99,99 €/Jahr.'],['Darstellung','Jahr vorausgewählt, Monat als Alternative. Kompakte Konditionen, keine erklärende Zeitleiste.'],['Erinnerung','Erforderliche Zahlungsmitteilungen; keine zusätzliche optionale Erinnerungs-Kampagne.'],['Einmaligkeit','Ein Trial pro Kunde; abgestimmte Prüfung auch bei neuer Registrierung und über Zahlungsanbieter hinweg.'],['Zugang','Bestehende bezahlte Funktionen und Nutzungslimits. Freemium bleibt separat.']
 ]:[['Testphase','7 Tage auf Monat und Jahr; danach gegebenenfalls Trial nur im Jahr.'],['Monat','9,99 € nach der Testphase.'],['Jahr','69,99 € im Jahr. Die spätere Verlängerung zu 99,99 € steht im Entwurf nicht dabei.'],['Darstellung','Jahr vorausgewählt. Zeitleiste: Heute → Tag 5 → Tag 7. Keine Streichpreise.'],['Erinnerung','Versprochene E-Mail an Tag 5; Handover nennt dafür trial_will_end.'],['Einmaligkeit','has_ever_trialed am Stripe-Kunden und am Lead; dann Angebot ohne Testphase.'],['Zugang','Unbegrenzte Scans und drei Alternativen je Produkt.']];
 box.innerHTML='<span class="tag">Textvergleich · kein bestehender Checkout</span><h2>'+(version==='nick'?'Dein separater Trial-Plan':'Jonas’ Trial-Handover')+'</h2><p>'+(version==='nick'?'Bestätigte Leitplanken, Revision 0.50. Noch keine aktivierte Trial-Implementierung.':'Anforderungen aus der Designreferenz #535. Noch keine Checkout-Anbindung.')+'</p><dl>'+entries.map(([a,b])=>'<dt>'+a+'</dt><dd>'+b+'</dd>').join('')+'</dl>';
}
if(area==='measurement'){
 source.hidden=true;const box=document.querySelector('#handover');box.hidden=false;box.className='preview-appendix';
 const entries=version==='nick'?[
 ['Einstieg','/lp/scan → /quiz → /result/[leadId]. Das Angebot ist bereits Teil dieser Route.'],
 ['Nach dem Checkout','/plan-bereit wartet auf die Bereitstellung, dann /scan?welcome=scan.'],
 ['Messung','OfferTrackingProvider, bestehendes offer_viewed und gemeinsame Abschnitts- und Funnel-Events.'],
 ['Zuordnung','Paket scan_v1 mit Offer scan-regal-v1; bestehende Kampagnen- und Funnel-Zuordnung.'],
 ['Freemium','freemiumScannerFirst ist ein separater kostenloser Pfad. Er ersetzt diesen bezahlten Funnel nicht.']
 ]:[
 ['Einstieg','/labs/scanner-offer ist eine Designreferenz. Keine neue produktive Route festgelegt.'],
 ['Nach dem Checkout','Lokaler onUnlock-Anschlusspunkt. Die Vorschau erstellt weder Konto noch Abo.'],
 ['Messung','Handover schlägt eigene Events vor, darunter einen Ersatz für offer_viewed. Noch nicht in die gemeinsame Messung integriert.'],
 ['Zuordnung','Soll Copy- und Struktur-Input für die bestehende Route liefern. Tracking bleibt Integrationsarbeit.'],
 ['Freemium','Die Frage aus dem Handover ist geklärt: Scanner-First im Freemium-Code und das bestehende bezahlte Angebot sind unterschiedliche Pfade.']
 ];
 box.innerHTML='<span class="tag">Technischer Textvergleich</span><h2>'+(version==='nick'?'Vorhandener Funnel':'Design-Handover')+'</h2><dl>'+entries.map(([a,b])=>'<dt>'+a+'</dt><dd>'+b+'</dd>').join('')+'</dl>';
}
// Local demo controls. No provider, analytics, registration or messaging endpoints.
let interval='quarter',catalog='personal_plan_launch_v1';
function setNickPricing(){const node=document.querySelector('#price-module');if(node)node.innerHTML=window.PREVIEW_PRICES[catalog+':'+interval]}
const catalogSelect=document.querySelector('#catalog');if(catalogSelect)catalogSelect.addEventListener('change',()=>{catalog=catalogSelect.value;setNickPricing()});
document.addEventListener('click',event=>{
 const a=event.target.closest('a');if(a){event.preventDefault();if(a.getAttribute('href')==='#pricing'){document.querySelector('#pricing')?.scrollIntoView({behavior:'smooth'});}else notify('Vorschau: Dieser Link wird hier nicht geöffnet.');return;}
 const b=event.target.closest('button');if(!b)return;
 const jump=b.dataset.quizJump;if(jump!==undefined){document.querySelectorAll('[data-quiz-page]').forEach(el=>el.hidden=el.dataset.quizPage!==jump);document.querySelectorAll('[data-quiz-jump]').forEach(el=>el.setAttribute('aria-current',String(el===b)));window.scrollTo(0,0);return;}
 if(b.dataset.offerPlanCard){interval=b.dataset.offerPlanCard;setNickPricing();return;}
 if(b.closest('#source-offer')){
   if(b.closest('header')||b.closest('[aria-hidden]')){document.querySelector('#pricing')?.scrollIntoView({behavior:'smooth'});return;}
   notify('Vorschau: Hier würde der Checkout bzw. die nächste Ansicht öffnen.');
 }
 if(b.closest('[data-quiz-page]')){const page=+b.closest('[data-quiz-page]').dataset.quizPage;const next=b.textContent.includes('Weiter')?Math.min(2,page+1):Math.max(0,page-1);document.querySelector(`[data-quiz-jump="${next}"]`).click();}
});
// Rendered Jonas plan data comes from his source fixture, preserved verbatim.
if(version==='jonas'){
 const selector=source.querySelector('fieldset');const originalLabels=[...selector.querySelectorAll('label')].map(x=>x.className);
 const annualText='69,99 € im Jahr, jederzeit kündbar.';const monthlyText='9,99 € im Monat, monatlich kündbar.';
 selector.addEventListener('change',event=>{if(event.target.name!=='scanner-offer-plan')return;const year=event.target.value==='year';const after=year?annualText:monthlyText;
 selector.querySelectorAll('label').forEach((label,i)=>{const checked=label.querySelector('input').checked;label.className=originalLabels[checked?0:1];const radio=label.querySelector('[aria-hidden]');radio.className='h-[18px] w-[18px] flex-none rounded-full '+(checked?'border-[6px] border-[var(--brand-plum)]':'border-[1.5px] border-[var(--brand-plum-light)]');});
 const timeline=[...source.querySelectorAll('ol li')].find(li=>li.textContent.includes('Tag 7'));if(timeline)timeline.querySelector('strong').nextElementSibling.textContent=after;
 const fine=[...source.querySelectorAll('p')].find(p=>p.textContent.startsWith('Danach '));if(fine)fine.textContent='Danach '+after+' Kündbar bis Tag 7 ohne Kosten. Es gilt das 14-tägige Widerrufsrecht.';
 const small=source.querySelector('.fixed small');if(small)small.textContent='7 Tage kostenlos, dann '+after.replace(/\.$/,'');
 });
 const sticky=source.querySelector('.fixed[aria-hidden]');const wa=source.querySelector('a[aria-label="Frage per WhatsApp stellen"]');
 if(['full','opening','mobile'].includes(area)&&sticky){const updateSticky=()=>{const visible=source.querySelector('#pricing').getBoundingClientRect().bottom<0;sticky.classList.toggle('translate-y-full',!visible);sticky.classList.toggle('translate-y-0',visible);sticky.setAttribute('aria-hidden',String(!visible));sticky.querySelector('button').tabIndex=visible?0:-1;if(wa){wa.classList.toggle('bottom-6',!visible);wa.classList.toggle('bottom-[92px]',visible)}};window.addEventListener('scroll',updateSticky,{passive:true});window.addEventListener('load',()=>requestAnimationFrame(updateSticky));}

}
if(area==='mobile')window.addEventListener('load',()=>{source.querySelector(version==='nick'?'[data-offer-section="highlights"]':'[data-offer-section="included"]').scrollIntoView();});
// Freeze source animation at its rendered result for side-by-side readability.
if(area==='opening'||area==='full'){/* The main offer source stays complete and scrollable. */}
