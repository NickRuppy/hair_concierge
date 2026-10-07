/** Scoped to this presentation; the organic offer and shared pricing keep their own styles. */
export const scannerRefinedStyles = `
.sr-offer{background:#f1edf5;color:#2a1845;--sr-dock-height:calc(75px + env(safe-area-inset-bottom));font-family:var(--font-plus-jakarta-sans, sans-serif),'Plus Jakarta Sans',sans-serif}
.sr-offer .sr-page{max-width:480px;margin:auto;min-height:100svh;background:#fcfaf7;overflow-wrap:break-word;padding-bottom:calc(var(--sr-dock-height) + 84px)}
.sr-offer h1,.sr-offer h2{font-family:var(--font-playfair-display, Georgia),'Playfair Display',Georgia,serif;letter-spacing:-.025em}
.sr-offer p,.sr-offer blockquote,.sr-offer figcaption{color:#624c76}
.sr-offer .sr-eyebrow{font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:800;color:#6b4e86;line-height:1.5;margin:0}
.sr-offer .sr-header{position:sticky;top:0;z-index:30;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;background:#fcfaf7f2;backdrop-filter:blur(12px);border-bottom:1px solid #7657a21a}
.sr-offer .sr-wordmark{font-family:var(--font-playfair-display, Georgia),Georgia,serif;font-size:24px;font-weight:600;letter-spacing:-.025em;color:#2a1845;text-decoration:none}
.sr-offer .sr-header>a:last-child{min-height:44px;display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:99px;background:var(--brand-plum);color:#fff;font-size:13px;font-weight:700;text-decoration:none}
.sr-offer .sr-hero{padding:27px 20px 25px;text-align:center}
.sr-offer .sr-hero h1{font-size:36px;line-height:1.07;max-width:14ch;margin:12px auto 0}
.sr-offer .sr-hero>p:last-child{font-size:14px;line-height:1.65;max-width:28ch;margin:14px auto 0}
.sr-offer .sr-diagnosis{padding:24px 18px;border-block:1px solid #7657a214;background:#ffffff8c}
.sr-offer .sr-diagnosis>h2{font-size:28px;text-align:center;line-height:1.25;margin:0}
.sr-offer .sr-diagnostic-rows{display:grid;gap:12px;margin-top:16px}
.sr-offer [data-organic-diagnostic-row]{padding:16px;border-radius:18px}
.sr-offer [data-organic-diagnostic-row]>h3{font-size:22px}
.sr-offer [data-organic-diagnostic-row]>p{font-size:14px;line-height:1.65}
.sr-offer .sr-scanner{padding:24px 18px 22px}
.sr-offer .sr-bridge{background:#2a1845;border-radius:20px;padding:22px}
.sr-offer .sr-bridge h2{font-size:28px;line-height:1.15;margin:10px 0 12px;color:white}
.sr-offer .sr-bridge p{color:#eee8f6;font-size:15px;line-height:1.75;margin:0}
.sr-offer .sr-bridge .sr-eyebrow{color:#d5c5e7;font-size:11px}
.sr-offer .sr-examples{display:grid;gap:16px;padding-top:16px}
.sr-offer .sr-example-card{padding:15px;border:1px solid #e6dfeb;border-radius:20px;background:white;min-width:0}
.sr-offer .sr-section-label{display:flex;gap:12px;justify-content:space-between;align-items:center}
.sr-offer .sr-section-label h2{font-family:inherit;font-size:16px;font-weight:600;line-height:1.4;margin:0;letter-spacing:normal}
.sr-offer .sr-section-label>span{border-radius:20px;background:#eee8f6;color:#6b50a0;padding:4px 10px;font-size:10px;font-weight:700;flex-shrink:0}
.sr-offer .sr-shelf{display:block;width:100%;height:auto;margin-top:16px;border-radius:14px}
.sr-offer .sr-result-phone{padding:14px 10px}
.sr-offer .sr-result-phone .sr-section-label{padding:0 4px;gap:10px}
.sr-offer .sr-zoom-trigger{display:block;width:100%;border:0;padding:0;margin-top:14px;background:transparent;color:#624c76;cursor:zoom-in;font:inherit}
.sr-offer .sr-phone-stage{display:block;padding:10px 5px;overflow:hidden;border-radius:16px;background:#eee8f6}
.sr-offer .sr-phone{display:block;position:relative;width:100%;max-width:310px;margin:auto;border:4px solid #29232e;border-radius:30px;background:#fdfbf9;box-shadow:0 18px 35px #30203d24;overflow:hidden;padding-top:19px}
.sr-offer .sr-camera{position:absolute;top:4px;left:50%;transform:translateX(-50%);width:62px;height:10px;border-radius:16px;background:#29232e}
.sr-offer .sr-phone img{display:block;width:100%;height:auto}
.sr-offer .sr-zoom-hint{display:flex;align-items:center;justify-content:center;min-height:44px;font-size:13px;font-weight:600}
.sr-offer .sr-section{padding:22px 18px}
.sr-offer .sr-section>h2{font-size:30px;line-height:1.12;margin:10px 0 12px}
.sr-offer .sr-outcome{padding-top:0;padding-bottom:8px;display:grid;gap:10px}
.sr-offer .sr-pain{display:grid;place-items:center;padding:17px 14px;text-align:center;font-size:20px;font-weight:600;line-height:1.45;background:#fbe9e5;color:#8b3545;border:1px dashed #cf9290;border-radius:12px}
.sr-offer .sr-pain s{text-decoration-color:#8b3545;text-decoration-thickness:2px}
.sr-offer .sr-gain{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px 20px;text-align:center;background:#eee8f6;border:1px solid #d8c9e7;border-radius:16px}
.sr-offer .sr-gain>span{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:50%;background:#7657a2;color:white;font-size:18px;line-height:1}
.sr-offer .sr-gain h2{width:100%;max-width:15ch;margin:0 auto;font-size:30px;line-height:1.17;text-align:center;text-wrap:balance}
.sr-offer .sr-video{padding-top:32px;padding-bottom:32px;text-align:center}
.sr-offer .sr-video h2{max-width:17ch;margin:0 auto;text-wrap:balance}
.sr-offer .sr-video .sr-eyebrow{margin:0 0 12px}
.sr-offer .sr-video figure{max-width:290px;margin:20px auto 0}
.sr-offer .sr-video video{width:100%;aspect-ratio:9/16;display:block;object-fit:cover;border-radius:22px;background:#201628}
.sr-offer .sr-video video::cue{color:white;background:#181024e0;font-family:Arial,sans-serif;font-size:15px}
.sr-offer .sr-video figcaption{font-size:12px;line-height:1.6;margin-top:10px}
.sr-offer .sr-video [role=status]{font-size:14px;line-height:1.6;padding:16px;border-radius:16px;background:#eee8f6}
.sr-offer .sr-video [role=status] a{text-decoration:underline}
.sr-offer .sr-pricing{scroll-margin-top:80px;padding-top:27px;padding-bottom:29px;border-top:1px solid #e7deee}
.sr-offer .sr-trial-card{padding:18px 15px 16px;margin-top:22px;border:1.5px solid #b7a0cf;border-radius:20px;background:white}
.sr-offer .sr-timeline{margin:0 0 23px;padding:0 2px;list-style:none}
.sr-offer .sr-timeline li{position:relative;display:grid;grid-template-columns:18px minmax(0,1fr);gap:13px;padding-bottom:20px}
.sr-offer .sr-timeline li:last-child{padding-bottom:0}
.sr-offer .sr-timeline li>span{display:block;width:12px;height:12px;background:#b9a6cf;border-radius:50%;margin-top:5px;position:relative;z-index:1}
.sr-offer .sr-timeline li:first-child>span{background:#7657a2}
.sr-offer .sr-timeline li:not(:last-child):before{content:'';position:absolute;top:15px;bottom:-6px;left:5px;width:2px;background:#e0d4eb}
.sr-offer .sr-timeline strong{display:block;font-size:15px;font-weight:700;line-height:1.4;color:#2a1845}
.sr-offer .sr-timeline p{font-size:13px;line-height:1.5;margin:3px 0 0}
.sr-offer .sr-contact-inline{display:block;margin:14px auto 0;min-height:44px;padding:8px 10px;border:0;background:transparent;text-decoration:underline;text-underline-offset:3px;color:#624c76;font:600 12px/1.5 var(--font-plus-jakarta-sans, sans-serif),sans-serif;cursor:pointer}
.sr-offer .sr-benefits{border-top:1px solid #e7deee;padding-top:29px;padding-bottom:27px}
.sr-offer .sr-benefit-track{list-style:none;display:flex;overflow-x:auto;scroll-snap-type:x mandatory;gap:12px;padding:0 0 13px;margin:22px 0 0}
.sr-offer .sr-benefit-track>li{width:208px;flex:0 0 208px;background:white;border:1px solid #e4dbea;border-radius:18px;overflow:hidden;scroll-snap-align:start}
.sr-offer .sr-tour-image{height:250px;overflow:hidden;position:relative;background:#eee8f6}
.sr-offer .sr-tour-image img{display:block;width:100%;height:auto}
.sr-offer .sr-tour-image>span{position:absolute;bottom:10px;left:10px;background:#7657a2;color:white;border-radius:20px;padding:4px 9px;font-size:10px;font-weight:700}
.sr-offer .sr-benefit-track h3{font-size:15px;font-weight:700;padding:12px 14px 5px;margin:0}
.sr-offer .sr-benefit-track p{font-size:13px;line-height:1.55;padding:0 14px 16px;margin:0}
.sr-offer .sr-carousel-controls{display:flex;justify-content:flex-end;gap:8px}
.sr-offer .sr-carousel-controls button{width:44px;min-height:44px;border:1px solid #e4dbea;border-radius:50%;background:#eee8f6;color:#624c76;cursor:pointer}
.sr-offer .sr-testimonials{padding-top:28px;padding-bottom:20px;border-top:1px solid #e7deee}
.sr-offer .sr-testimonials>div{display:grid;gap:12px;margin-top:20px}
.sr-offer .sr-testimonials figure{margin:0;border:1px solid #e5dbea;border-radius:18px;background:white;padding:20px;display:flex;flex-direction:column;gap:10px;text-align:center}
.sr-offer .sr-testimonials blockquote{font-size:14px;line-height:1.7;margin:0}
.sr-offer .sr-testimonials figcaption{font-size:15px;line-height:1.45;font-weight:700;color:#2a1845;margin:0}
.sr-offer .sr-faq{padding-top:24px;padding-bottom:24px}
.sr-offer .sr-faq>h2{font-size:28px;margin-bottom:22px}
.sr-offer .sr-faq details{border-bottom:1px solid #e4daeb;padding:0}
.sr-offer .sr-faq summary{font-size:14px;font-weight:600;line-height:1.5;color:#3a254f;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:15px;min-height:56px;padding:17px 0;cursor:pointer}
.sr-offer .sr-faq summary::-webkit-details-marker{display:none}
.sr-offer .sr-faq summary>span{font-size:22px;color:#8a709e;font-weight:400;transition:transform .15s}
.sr-offer .sr-faq details[open] summary>span{transform:rotate(45deg)}
.sr-offer .sr-faq details>p{font-size:13px;line-height:1.7;padding:0 26px 19px 0;margin:0}
.sr-offer .sr-footer-contact{padding:0 18px 18px}
.sr-offer .sr-footer-contact .sr-contact-inline{margin-top:0}
.sr-offer .sr-footer{margin-top:0;padding:24px 18px;background:#fcfaf7}
.sr-offer .sr-footer nav a{min-height:44px;font-size:12px;color:#624c76}
.sr-offer .sr-dock{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:480px;box-sizing:border-box;padding:12px 16px calc(12px + env(safe-area-inset-bottom));z-index:45;background:#fcfaf7;border-top:1px solid #e3d9eb;box-shadow:0 -4px 16px #2a18450a}
.sr-offer .sr-dock a{display:flex;align-items:center;justify-content:center;gap:16px;min-height:50px;border-radius:16px;background:#ad4559;color:#fff;font-size:14px;font-weight:700;line-height:1.4;text-decoration:none;padding:10px 14px;box-sizing:border-box}
.sr-offer .sr-whatsapp{position:fixed;right:max(16px,calc((100vw - 480px)/2 + 16px));bottom:calc(var(--sr-dock-height) + 12px);z-index:46;width:56px;height:56px;display:grid;place-items:center;padding:0;border:2px solid white;border-radius:50%;background:#168747;color:#fff;box-shadow:0 4px 14px #174b2833;cursor:pointer}
.sr-offer .sr-dialog{margin:auto;border:1px solid #d5c7e0;border-radius:22px;padding:24px;max-width:360px;width:calc(100% - 32px);max-height:calc(100dvh - 32px);color:#3a254f;background:#fdfbf9;overflow:auto}
.sr-offer .sr-dialog::backdrop{background:#21162b80}
.sr-offer .sr-dialog h2{font-size:25px;line-height:1.2;margin:8px 0 15px}
.sr-offer .sr-dialog p{font-size:14px;line-height:1.75}
.sr-offer .sr-contact-dialog button{display:block;margin-top:22px;background:#7657a2;color:white;border:0;padding:13px;border-radius:12px;width:100%;min-height:44px;font-weight:700;cursor:pointer}
.sr-offer .sr-example-dialog{width:min(540px,calc(100% - 16px));max-width:none;max-height:calc(100dvh - 16px);padding:0;border-radius:16px;overflow:hidden}
.sr-offer .sr-zoom-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;background:#fcfaf7;border-bottom:1px solid #e3d9eb}
.sr-offer .sr-zoom-toolbar h2{font-family:inherit;font-size:13px;line-height:1.4;margin:0;letter-spacing:normal}
.sr-offer .sr-zoom-toolbar button{width:44px;height:44px;flex:0 0 44px;border:0;border-radius:50%;background:#eee8f6;color:#2a1845;font-size:26px;cursor:pointer}
.sr-offer .sr-zoom-scroll{overflow:auto;max-height:calc(100dvh - 100px);overscroll-behavior:contain}
.sr-offer .sr-zoom-scroll img{display:block;width:100%;min-width:390px;height:auto;max-width:none}
.sr-offer a:focus-visible,.sr-offer button:focus-visible,.sr-offer summary:focus-visible,.sr-offer [tabindex="0"]:focus-visible{outline:3px solid #7657a2;outline-offset:3px}
@media(max-width:360px){.sr-offer .sr-section{padding-left:14px;padding-right:14px}.sr-offer .sr-trial-card{padding:17px 11px 14px}.sr-offer .sr-gain{padding:22px 16px}.sr-offer .sr-gain h2{font-size:27px}.sr-offer .sr-section-label h2{font-size:15px}.sr-offer .sr-hero h1{font-size:33px}.sr-offer .sr-testimonials figure{padding:18px}.sr-offer .sr-header{padding-left:12px;padding-right:12px}}
@media(prefers-reduced-motion:reduce){.sr-offer *{scroll-behavior:auto!important;transition:none!important}}
`
