// Set only after an actual production screenshot has been captured and inspected.
const productionScreenSource = 'images/production/ogx-production-scan-390x844.jpg';
if(productionScreenSource){document.querySelectorAll('[data-production-screen]').forEach(container=>{const image=document.createElement('img');image.src=productionScreenSource;image.alt='Echtes Chaarlie-Scan-Ergebnis: OGX Argan Oil of Morocco Shampoo mit Produktfoto, 2 von 3 Zielbereichen getroffen';container.replaceChildren(image)})}
