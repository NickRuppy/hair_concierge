const dialog=document.getElementById('draft-dialog');
function showDraftMessage(title,copy){document.getElementById('dialog-heading').textContent=title;document.getElementById('dialog-copy').textContent=copy;dialog.showModal()}
document.querySelectorAll('[name="draft-plan"]').forEach(r=>r.addEventListener('change',()=>{document.getElementById('draft-price-terms').textContent=r.value==='year'?'Nach 7 Tagen: 69,99 € im ersten Jahr, danach 99,99 € / Jahr. Vor Testende kündigen: keine Kosten.':'Nach 7 Tagen: 9,99 € / Monat. Vor Testende kündigen: keine Kosten.'}));
document.getElementById('draft-checkout').onclick=()=>showDraftMessage('Vorschau der Tarifauswahl','Im fertigen Ablauf öffnet sich hier das gemeinsame Zahlungs-Overlay. Dieser Entwurf startet keinen Kauf und keinen Test.');
document.getElementById('draft-whatsapp').onclick=()=>showDraftMessage('WhatsApp-Kontakt im Entwurf','Dieser Button öffnet später den WhatsApp-Kontakt. Zielnummer und Nachricht werden vor der Umsetzung bestätigt; hier wird keine Nachricht gesendet.');
document.querySelectorAll('.dialog-close,.dialog-done').forEach(b=>b.onclick=()=>dialog.close());
