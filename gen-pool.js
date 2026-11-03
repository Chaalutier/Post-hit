// Régénère pool.json : `node gen-pool.js`. Requêtes trop lentes pour être faites dans le navigateur.
const fs = require('fs');

// Seuil de notoriété = nombre d'articles Wikipédia (toutes langues) sur la personne.
const REAL = [
  ['Q33999', 90],    // acteur
  ['Q177220', 90],   // chanteur
  ['Q2252262', 70],  // rappeur
  ['Q937857', 90],   // footballeur
  ['Q3665646', 70],  // basketteur
  ['Q10833314', 70], // joueur de tennis
  ['Q36180', 120],   // écrivain
  ['Q2526255', 90],  // réalisateur
  ['Q1028181', 90],  // peintre
  ['Q169470', 90],   // physicien
];
const FICTION_MIN = 25;

async function sparql(q, tries = 4) {
  try {
    const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'post-hit-pool/1.0' },
    });
    if (!res.ok) throw new Error(res.status + ' ' + (await res.text()).slice(0, 200));
    return (await res.json()).results.bindings.map(b => b.p.value.split('/').pop());
  } catch (err) {
    // 429 (quota de temps de requête) ou coupure réseau : on attend et on réessaie
    if (--tries === 0) throw err;
    console.log('  nouvel essai :', err.message.slice(0, 80));
    await new Promise(r => setTimeout(r, 60000));
    return sparql(q, tries);
  }
}

(async () => {
  const reel = new Set();
  for (const [occ, min] of REAL) {
    const ids = await sparql(`SELECT ?p WHERE { ?p wdt:P106 wd:${occ}; wikibase:sitelinks ?s. FILTER(?s > ${min}) ?p wdt:P18 [] }`);
    console.log(occ, ids.length);
    ids.forEach(id => reel.add(id));
  }
  const fictif = await sparql(`SELECT DISTINCT ?p WHERE { ?p wdt:P31/wdt:P279* wd:Q95074; wikibase:sitelinks ?s. FILTER(?s > ${FICTION_MIN}) }`);
  console.log('fictif', fictif.length);
  if (reel.size < 500 || fictif.length < 200) throw new Error('Pool trop petit, requête probablement en timeout');
  fs.writeFileSync(__dirname + '/pool.json', JSON.stringify({ reel: [...reel], fictif }));
})();
