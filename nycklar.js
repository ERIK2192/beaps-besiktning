/* Key bundle register.
 *
 * Loaded on demand by index.html the first time a QR code is scanned, so it costs
 * nothing on an ordinary inspection.
 *
 * The QR code on a tag holds the bundle number, bare ("112:3") or as the link
 * https://beaps.se/#nyckel=112:3 — no address, no key data either way. A stranger who
 * scans a dropped ring gets a number, or the company website, and nothing that means
 * anything outside this file.
 *
 * Shape:
 *   id  bundle number exactly as the key list has it, "112:3" or "112:EXTRA"
 *   a   address        l  apartment number        n  apartment name, may be empty
 *   k   the keys, each [type, marking, quantity, note] — quantity and note optional
 *
 * Seeded from Nyckellista Pondus Pro, Upplandsgatan 91B (objects 112-119), complete
 * including its gaps: 112 starts at ring 3 because rings 1 and 2 are not in the list.
 * The remaining ~340 bundles come with the full import, which needs a review pass
 * first — about twenty keys in the list are marked "vart går denna???" and several
 * rings were out on loan when the inventory was taken.
 */
window.NYCKLAR = [

  /* --- 112 · Upplandsgatan 91B, lgh 1102 TÄRNA --- */
  { id:'112:3', a:'Upplandsgatan 91B', l:'1102', n:'TÄRNA', k:[
    ['Lägenhetsnyckel','1352574'],
    ['Postboxnyckel','Din Box'],
    ['HG-nyckel','AS 19S'],
    ['Oidentifierad','38R',1,'vart går denna?'],
    ['Bricka','MFR198549179'] ]},
  { id:'112:EXTRA', a:'Upplandsgatan 91B', l:'1102', n:'TÄRNA', k:[
    ['Kopieringsoriginal blå','1352574'],
    ['Postboxnyckel','Din Box'],
    ['Överlåsnyckel','ASSA',4] ]},

  /* --- 113 · Upplandsgatan 91B, lgh 1301 TRAST --- */
  { id:'113:1', a:'Upplandsgatan 91B', l:'1301', n:'TRAST', k:[
    ['Lägenhetsnyckel','1069111'],
    ['Bricka','MFR 854248010'],
    ['HG-nyckel','845 BH M'],
    ['HG-nyckel','AS 19S'],
    ['Oidentifierad','',1,'vart går denna?'] ]},
  { id:'113:2', a:'Upplandsgatan 91B', l:'1301', n:'TRAST', k:[
    ['Lägenhetsnyckel','1069111'],
    ['Postboxnyckel','Din Box'] ]},
  { id:'113:3', a:'Upplandsgatan 91B', l:'1301', n:'TRAST', k:[
    ['Lägenhetsnyckel','1069111'],
    ['Postboxnyckel',''],
    ['HG-nyckel','',2,'vart går dessa?'],
    ['Bricka','MFR 199540731'] ]},
  { id:'113:EXTRA', a:'Upplandsgatan 91B', l:'1301', n:'TRAST', k:[
    ['Lägenhetsnyckel','1069111'],
    ['Postboxnyckel','Din Box'],
    ['Kopieringsoriginal blå','1069111'],
    ['HG-nyckel','AS 19S'],
    ['Överlåsnyckel','ASSA',3] ]},

  /* --- 114 · Upplandsgatan 91B, lgh 1001 DOPPING --- */
  { id:'114:1', a:'Upplandsgatan 91B', l:'1001', n:'DOPPING', k:[
    ['Lägenhetsnyckel','1690213'],
    ['HG-nyckel',''],
    ['Postboxnyckel','Din Box'],
    ['Bricka','MFR 853241386'] ]},
  { id:'114:2', a:'Upplandsgatan 91B', l:'1001', n:'DOPPING', k:[
    ['Lägenhetsnyckel','1690213'],
    ['Postboxnyckel','Din Box'] ]},
  { id:'114:3', a:'Upplandsgatan 91B', l:'1001', n:'DOPPING', k:[
    ['Lägenhetsnyckel','1690213'],
    ['Postboxnyckel','Din Box'],
    ['HG-nyckel','845 BH M'],
    ['Bricka','MFR 201101227'] ]},
  { id:'114:EXTRA', a:'Upplandsgatan 91B', l:'1001', n:'DOPPING', k:[
    ['Postboxnyckel','Din Box'],
    ['Kopieringsoriginal blå','1690213'],
    ['Överlåsnyckel','ASSA',4] ]},

  /* --- 115 · Upplandsgatan 91B, lgh 1201 FÅGEL --- */
  { id:'115:1', a:'Upplandsgatan 91B', l:'1201', n:'FÅGEL', k:[
    ['Lägenhetsnyckel','2290229'],
    ['HG-nyckel','845 BH M',2],
    ['Postboxnyckel','Din Box'],
    ['Bricka','MFR 853145418'] ]},
  { id:'115:2', a:'Upplandsgatan 91B', l:'1201', n:'FÅGEL', k:[
    ['Lägenhetsnyckel','2290229'],
    ['HG-nyckel','845 BH M'],
    ['Postboxnyckel','Din Box'] ]},
  { id:'115:3', a:'Upplandsgatan 91B', l:'1201', n:'FÅGEL', k:[
    ['Lägenhetsnyckel','2290229'],
    ['Postboxnyckel','Din Box'],
    ['Oidentifierad','',1,'vart går denna?'],
    ['Bricka','MFR 201102107'] ]},
  { id:'115:EXTRA', a:'Upplandsgatan 91B', l:'1201', n:'FÅGEL', k:[
    ['Lägenhetsnyckel','2290229'],
    ['Kopieringsoriginal blå','2290229'],
    ['Postboxnyckel','Din Box'],
    ['Överlåsnyckel','ASSA',4] ]},

  /* --- 116 · Upplandsgatan 91B, lgh 1302 HÄGER --- */
  { id:'116:1', a:'Upplandsgatan 91B', l:'1302', n:'HÄGER', k:[
    ['Lägenhetsnyckel','1247675'],
    ['Postboxnyckel','Din Box'],
    ['Bricka','MFR 853036986'],
    ['Oidentifierad','845 BH M',1,'vart går denna?'] ]},
  { id:'116:2', a:'Upplandsgatan 91B', l:'1302', n:'HÄGER', k:[
    ['Lägenhetsnyckel','1247675'],
    ['Postboxnyckel','Din Box'],
    ['Oidentifierad','845 BH M',1,'vart går denna?'] ]},
  { id:'116:3', a:'Upplandsgatan 91B', l:'1302', n:'HÄGER', k:[
    ['Lägenhetsnyckel','1247675'],
    ['Postboxnyckel','Din Box'],
    ['HG-nyckel','A29 6M'],
    ['Bricka','MFR 200511499'] ]},
  { id:'116:EXTRA', a:'Upplandsgatan 91B', l:'1302', n:'HÄGER', k:[
    ['Lägenhetsnyckel','1247675',3],
    ['Oidentifierad','SE05330',1,'vart går denna?'],
    ['HG-nyckel','AS GM5',1,'finns också en knippa till övermålat övre lås?'],
    ['Kopieringsoriginal blå','1247675'],
    ['Överlåsnyckel','ASSA',4] ]},

  /* --- 117 · Upplandsgatan 91B, lgh 1103 FENIX --- */
  { id:'117:1', a:'Upplandsgatan 91B', l:'1103', n:'FENIX', k:[
    ['Lägenhetsnyckel','2017440'],
    ['Postboxnyckel','Din Box'],
    ['Bricka','MFR 853209066'],
    ['HG-nyckel','A35 GM'],
    ['HG-nyckel','845 BH M'] ]},
  { id:'117:2', a:'Upplandsgatan 91B', l:'1103', n:'FENIX', k:[
    ['Lägenhetsnyckel','2017440'],
    ['Postboxnyckel','Din Box'] ]},
  { id:'117:3', a:'Upplandsgatan 91B', l:'1103', n:'FENIX', k:[
    ['Lägenhetsnyckel','2017440'],
    ['Postboxnyckel','Din Box'],
    ['HG-nyckel','845 BH M'],
    ['Bricka','MFR 200424811'] ]},
  { id:'117:EXTRA', a:'Upplandsgatan 91B', l:'1103', n:'FENIX', k:[
    ['Kopieringsoriginal blå','2017440'],
    ['Lägenhetsnyckel','2017440'],
    ['Postboxnyckel','Din Box'],
    ['Överlåsnyckel','ASSA',4] ]},

  /* --- 118 · Upplandsgatan 91B, lgh 1104 ORRE --- */
  { id:'118:1', a:'Upplandsgatan 91B', l:'1104', n:'ORRE', k:[
    ['Lägenhetsnyckel','1272103'],
    ['Bricka','MFR 853119578'],
    ['Oidentifierad','945 BH M',1,'vart går denna?'],
    ['Postboxnyckel','Din Box'],
    ['Oidentifierad','',1,'vart går denna?'] ]},
  { id:'118:2', a:'Upplandsgatan 91B', l:'1104', n:'ORRE', k:[
    ['Lägenhetsnyckel','1272103'],
    ['Oidentifierad','',1,'vart går denna?'] ]},
  { id:'118:3', a:'Upplandsgatan 91B', l:'1104', n:'ORRE', k:[
    ['Lägenhetsnyckel','1272103'],
    ['Postboxnyckel','Din Box'],
    ['HG-nyckel','aki 6M'],
    ['Bricka','MFR200511195'] ]},
  { id:'118:EXTRA', a:'Upplandsgatan 91B', l:'1104', n:'ORRE', k:[
    ['Kopieringsoriginal blå','1272103'],
    ['Lägenhetsnyckel','1272103'],
    ['Postboxnyckel','Din Box'],
    ['Överlåsnyckel','ASSA',4] ]},

  /* --- 119 · Upplandsgatan 91B, lgh 1002 FASAN --- */
  { id:'119:1', a:'Upplandsgatan 91B', l:'1002', n:'FASAN', k:[
    ['Lägenhetsnyckel','1432392'],
    ['Bricka','MFR 853145834'],
    ['Postboxnyckel','Din Box'],
    ['HG-nyckel',''] ]},
  { id:'119:2', a:'Upplandsgatan 91B', l:'1002', n:'FASAN', k:[
    ['Lägenhetsnyckel','1432392'],
    ['Postboxnyckel','Din Box'] ]},
  { id:'119:3', a:'Upplandsgatan 91B', l:'1002', n:'FASAN', k:[
    ['Lägenhetsnyckel','1432392'],
    ['Postboxnyckel','Din Box'],
    ['Oidentifierad','38R',1,'vart går denna?'],
    ['Bricka','MFR 201101083'] ]},
  { id:'119:EXTRA', a:'Upplandsgatan 91B', l:'1002', n:'FASAN', k:[
    ['Kopieringsoriginal blå','1432392'],
    ['Lägenhetsnyckel','1432392'],
    ['Postboxnyckel','Din Box'],
    ['Överlåsnyckel','ASSA',4] ]}
];
