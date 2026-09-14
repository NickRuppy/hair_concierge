const scanZoom=document.getElementById('scan-zoom-dialog');document.querySelector('.scan-zoom-trigger').addEventListener('click',()=>scanZoom.showModal());document.querySelector('.scan-zoom-close').addEventListener('click',()=>scanZoom.close());scanZoom.addEventListener('click',event=>{if(event.target===scanZoom)scanZoom.close()});
const captionVideo=document.getElementById('jonas-video');function enableDraftCaptions(){if(captionVideo.textTracks[0])captionVideo.textTracks[0].mode='showing'}captionVideo.addEventListener('loadedmetadata',enableDraftCaptions);enableDraftCaptions();

// Inline contact actions remain local stubs. The fixed purchase CTA jumps to pricing.
const contactFloat=document.getElementById('draft-whatsapp');
document.querySelectorAll('[data-contact-whatsapp]').forEach(button=>button.addEventListener('click',()=>contactFloat.click()));

// Measure the dock, including safe-area and text wrapping, to keep both controls apart.
const purchaseDock=document.querySelector('.purchase-dock');
function positionWhatsApp(){document.documentElement.style.setProperty('--purchase-dock-height',purchaseDock.getBoundingClientRect().height+'px')}
new ResizeObserver(positionWhatsApp).observe(purchaseDock);positionWhatsApp();
