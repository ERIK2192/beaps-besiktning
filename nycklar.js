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
 * Swedenborgsgatan 13 added from the supplied tabular list on 2026-10-09:
 * 15 apartments, 62 bundles, 229 source rows. Blank markings, repeats and notes preserved.
 * Original entries seeded from Nyckellista Pondus Pro, Upplandsgatan 91B (objects 112-119), complete
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
    ['Överlåsnyckel','ASSA',4] ]},

  // Swedenborgsgatan 13: supplied tabular list, 2026-10-09. Repeated rows and notes preserved.
  {"id":"424:1","a":"Swedenborgsgatan 13","l":"1101","n":"FERRET","k":[["Lägenhetsnyckel","1233105"],["HG-nyckel","OFG87355"],["Bricka","MFR646445002"],["Postboxnyckel",""]]},
  {"id":"424:2","a":"Swedenborgsgatan 13","l":"1101","n":"FERRET","k":[["Lägenhetsnyckel","1233105"],["HG-nyckel","OFG87355"],["Postboxnyckel",""]]},
  {"id":"424:3","a":"Swedenborgsgatan 13","l":"1101","n":"FERRET","k":[["Lägenhetsnyckel","1233105"],["HG-nyckel",""],["Postboxnyckel","Din Box"],["Tvättbokningscylindernyckel","9298"]]},
  {"id":"424:EXTRA","a":"Swedenborgsgatan 13","l":"1101","n":"FERRET","k":[["Kopieringsoriginal blå","1233105"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"441:1","a":"Swedenborgsgatan 13","l":"1105","n":"DEER","k":[["Lägenhetsnyckel","1341379"],["Bricka","MFR648448970"],["HG-nyckel","OFG87355"],["Postboxnyckel","Silica"]]},
  {"id":"441:2","a":"Swedenborgsgatan 13","l":"1105","n":"DEER","k":[["Lägenhetsnyckel","1341379"],["HG-nyckel","OFG87355"],["Postboxnyckel","Silica"]]},
  {"id":"441:3","a":"Swedenborgsgatan 13","l":"1105","n":"DEER","k":[["Lägenhetsnyckel","1341379"],["HG-nyckel","OFG87355"],["Postboxnyckel","Din Box"]]},
  {"id":"441:EXTRA","a":"Swedenborgsgatan 13","l":"1105","n":"DEER","k":[["Kopieringsoriginal blå","1341379"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"442:1","a":"Swedenborgsgatan 13","l":"1103","n":"CROW","k":[["Lägenhetsnyckel","1309962"],["HG-nyckel","OFG87355"],["Bricka","MFR646445002"],["Postboxnyckel","Din Box"]]},
  {"id":"442:2","a":"Swedenborgsgatan 13","l":"1103","n":"CROW","k":[["Lägenhetsnyckel","1309962"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"]]},
  {"id":"442:3","a":"Swedenborgsgatan 13","l":"1103","n":"CROW","k":[["Lägenhetsnyckel","1309962"],["HG-nyckel","OFG87355"],["Postboxnyckel","Din Box"],["Tvättbokningscylindernyckel","9296"]]},
  {"id":"442:EXTRA","a":"Swedenborgsgatan 13","l":"1103","n":"CROW","k":[["Kopieringsoriginal blå","1309962"]]},
  {"id":"448:1","a":"Swedenborgsgatan 13","l":"1204","n":"TIGER","k":[["Lägenhetsnyckel","1290329"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"],["Bricka","MFR647047562"]]},
  {"id":"448:2","a":"Swedenborgsgatan 13","l":"1204","n":"TIGER","k":[["Lägenhetsnyckel","1290329"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"]]},
  {"id":"448:3","a":"Swedenborgsgatan 13","l":"1204","n":"TIGER","k":[["Lägenhetsnyckel","1290329"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"],["Tvättbokningscylindernyckel","9324"]]},
  {"id":"448:EXTRA","a":"Swedenborgsgatan 13","l":"1204","n":"TIGER","k":[["Lägenhetsnyckel","1290329"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Kopieringsoriginal blå","1290329"],["Lägenhetsnyckel","1290329"],["Postboxnyckel","Din Box"]]},
  {"id":"449:1","a":"Swedenborgsgatan 13","l":"1104","n":"FOX","k":[["Lägenhetsnyckel","1257203"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"],["Bricka","MFR646445002"]]},
  {"id":"449:2","a":"Swedenborgsgatan 13","l":"1104","n":"FOX","k":[["Lägenhetsnyckel","1257203"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"]]},
  {"id":"449:3","a":"Swedenborgsgatan 13","l":"1104","n":"FOX","k":[["Lägenhetsnyckel","1257203"],["Överlåsnyckel",""],["Postboxnyckel","Din Box"]]},
  {"id":"449:EXTRA","a":"Swedenborgsgatan 13","l":"1104","n":"FOX","k":[["Kopieringsoriginal blå","1257203"],["Postboxnyckel","Din Box"],["Överlåsnyckel",""],["Tvättbokningscylindernyckel","9077"]]},
  {"id":"459:1","a":"Swedenborgsgatan 13","l":"1205","n":"HAWK","k":[["Lägenhetsnyckel","1311182"],["Bricka","MFR664027098"],["HG-nyckel","OFG87355"],["Postboxnyckel",""]]},
  {"id":"459:2","a":"Swedenborgsgatan 13","l":"1205","n":"HAWK","k":[["Lägenhetsnyckel","1311182"],["HG-nyckel","OFG87355"],["Postboxnyckel",""]]},
  {"id":"459:3","a":"Swedenborgsgatan 13","l":"1205","n":"HAWK","k":[["Lägenhetsnyckel","1311182"],["Postboxnyckel","Din Box"]]},
  {"id":"459:EXTRA","a":"Swedenborgsgatan 13","l":"1205","n":"HAWK","k":[["Kopieringsoriginal blå","1311182"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"460:1","a":"Swedenborgsgatan 13","l":"1201","n":"WOLF","k":[["Lägenhetsnyckel","1543875"],["HG-nyckel","OFG87355"],["Bricka","MFR646445002"],["Postboxnyckel","Din Box"]]},
  {"id":"460:2","a":"Swedenborgsgatan 13","l":"1201","n":"WOLF","k":[["Lägenhetsnyckel","1543875"],["Postboxnyckel","Din Box"]]},
  {"id":"460:3","a":"Swedenborgsgatan 13","l":"1201","n":"WOLF","k":[["Lägenhetsnyckel","1543875"],["Överlåsnyckel",""],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"]]},
  {"id":"460:EXTRA","a":"Swedenborgsgatan 13","l":"1201","n":"WOLF","k":[["Lägenhetsnyckel","1543875"],["Lägenhetsnyckel","1543875"],["Lägenhetsnyckel","1543875"],["Kopieringsoriginal blå","1543875"],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"463:1","a":"Swedenborgsgatan 13","l":"1301","n":"BIRD","k":[["Lägenhetsnyckel","1895002"],["Postboxnyckel","Din Box"],["Bricka","MFR646445002"],["HG-nyckel","OFG87355"],["HG-nyckel","OFG87355"]]},
  {"id":"463:2","a":"Swedenborgsgatan 13","l":"1301","n":"BIRD","k":[["Lägenhetsnyckel","1895002"],["Lägenhetsnyckel","1895002"],["Postboxnyckel",""]]},
  {"id":"463:3","a":"Swedenborgsgatan 13","l":"1301","n":"BIRD","k":[["Lägenhetsnyckel","1895002"],["Postboxnyckel","Din Box"],["Tvättbokningscylindernyckel","9316"],["HG-nyckel","OFG87355"]]},
  {"id":"463:EXTRA","a":"Swedenborgsgatan 13","l":"1301","n":"BIRD","k":[["Kopieringsoriginal blå","1895002"],["Postboxnyckel",""],["HG-nyckel","OFG87355"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"737:1","a":"Swedenborgsgatan 13","l":"1203","n":"BADGER","k":[["Lägenhetsnyckel","2226835",1,"kolla denna då den var utlånad"]]},
  {"id":"737:2","a":"Swedenborgsgatan 13","l":"1203","n":"BADGER","k":[["Lägenhetsnyckel","2226835",1,"kolla denna då den var utlånad"]]},
  {"id":"737:3","a":"Swedenborgsgatan 13","l":"1203","n":"BADGER","k":[["Lägenhetsnyckel","2226835"],["Postboxnyckel","Din Box"]]},
  {"id":"737:EXTRA","a":"Swedenborgsgatan 13","l":"1203","n":"BADGER","k":[["Kopieringsoriginal blå","2226835"],["Överlåsnyckel",""],["Överlåsnyckel","",1,"vart går dessa?"],["???","",1,"vart går dessa?"],["???",""]]},
  {"id":"744:1","a":"Swedenborgsgatan 13","l":"1102","n":"EAGLE","k":[["Lägenhetsnyckel","1331552"],["HG-nyckel","OFG87355"],["Postboxnyckel",""],["Bricka","MFR646446074"]]},
  {"id":"744:2","a":"Swedenborgsgatan 13","l":"1102","n":"EAGLE","k":[["Lägenhetsnyckel","1331552"],["HG-nyckel",""],["Postboxnyckel",""]]},
  {"id":"744:3","a":"Swedenborgsgatan 13","l":"1102","n":"EAGLE","k":[["Lägenhetsnyckel","1331552"],["Postboxnyckel",""]]},
  {"id":"744:EXTRA","a":"Swedenborgsgatan 13","l":"1102","n":"EAGLE","k":[["Lägenhetsnyckel",""],["Kopieringsoriginal blå",""],["Postboxnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"745:1","a":"Swedenborgsgatan 13","l":"1202","n":"BEAR","k":[["Lägenhetsnyckel","1281864",1,"kolla denna då den var utlånad"],["Bricka","MFR647903850"]]},
  {"id":"745:2","a":"Swedenborgsgatan 13","l":"1202","n":"BEAR","k":[["Lägenhetsnyckel","1281864"],["Postboxnyckel","Din Box"]]},
  {"id":"745:3","a":"Swedenborgsgatan 13","l":"1202","n":"BEAR","k":[["Lägenhetsnyckel","1281864"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"],["Tvättbokningscylindernyckel","9247"]]},
  {"id":"745:EXTRA","a":"Swedenborgsgatan 13","l":"1202","n":"BEAR","k":[["Lägenhetsnyckel","1281864"],["Kopieringsoriginal blå","1281864"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Tvättbokningscylindernyckel","9247"],["Tvättbokningscylindernyckel","9247"]]},
  {"id":"746:1","a":"Swedenborgsgatan 13","l":"1302","n":"OTTER","k":[["Lägenhetsnyckel","1621093"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"],["Bricka","MFR648249914"]]},
  {"id":"746:2","a":"Swedenborgsgatan 13","l":"1302","n":"OTTER","k":[["Lägenhetsnyckel","1621093"],["Postboxnyckel","Din Box"]]},
  {"id":"746:3","a":"Swedenborgsgatan 13","l":"1302","n":"OTTER","k":[["Lägenhetsnyckel","1621093"],["HG-nyckel","OFG87355"],["Postboxnyckel","Din Box"]]},
  {"id":"746:4","a":"Swedenborgsgatan 13","l":"1302","n":"OTTER","k":[["Lägenhetsnyckel","1621093"],["Postboxnyckel","Din Box"]]},
  {"id":"746:EXTRA","a":"Swedenborgsgatan 13","l":"1302","n":"OTTER","k":[["Lägenhetsnyckel","1621093"],["Kopieringsoriginal blå","1621093"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"747:1","a":"Swedenborgsgatan 13","l":"1502","n":"GAZELLE","k":[["Lägenhetsnyckel","2442457",1,"kolla denna då den var utlånad"],["Bricka","MFR646915194"]]},
  {"id":"747:2","a":"Swedenborgsgatan 13","l":"1502","n":"GAZELLE","k":[["Lägenhetsnyckel","2442457",1,"kolla denna då den var utlånad"]]},
  {"id":"747:3","a":"Swedenborgsgatan 13","l":"1502","n":"GAZELLE","k":[["Lägenhetsnyckel","2442457"],["Postboxnyckel","Din Box"]]},
  {"id":"747:EXTRA","a":"Swedenborgsgatan 13","l":"1502","n":"GAZELLE","k":[["Lägenhetsnyckel","2442457"],["Kopieringsoriginal blå","2442457"],["Postboxnyckel","Din Box"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"748:1","a":"Swedenborgsgatan 13","l":"1501","n":"LION","k":[["Lägenhetsnyckel","1810050"],["HG-nyckel","OFG87355"],["Postboxnyckel",""],["Bricka",""]]},
  {"id":"748:2","a":"Swedenborgsgatan 13","l":"1501","n":"LION","k":[["Lägenhetsnyckel","1810050"],["Postboxnyckel",""]]},
  {"id":"748:3","a":"Swedenborgsgatan 13","l":"1501","n":"LION","k":[["Lägenhetsnyckel","1810050"],["Postboxnyckel",""]]},
  {"id":"748:EXTRA","a":"Swedenborgsgatan 13","l":"1501","n":"LION","k":[["Lägenhetsnyckel","1810050"],["Lägenhetsnyckel","1810050"],["Kopieringsoriginal blå","1810050"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]},
  {"id":"749:1","a":"Swedenborgsgatan 13","l":"1503","n":"OWL","k":[["Lägenhetsnyckel","2077659"],["Postboxnyckel","Din Box"],["Bricka","MFR645555514"],["HG-nyckel","OFG87355"]]},
  {"id":"749:2","a":"Swedenborgsgatan 13","l":"1503","n":"OWL","k":[["Lägenhetsnyckel","2077659"],["Postboxnyckel","Din Box"]]},
  {"id":"749:3","a":"Swedenborgsgatan 13","l":"1503","n":"OWL","k":[["Lägenhetsnyckel","2077659"],["Postboxnyckel","Din Box"],["HG-nyckel","OFG87355"]]},
  {"id":"749:4","a":"Swedenborgsgatan 13","l":"1503","n":"OWL","k":[["Lägenhetsnyckel","2077659"],["Postboxnyckel","Din Box"]]},
  {"id":"749:EXTRA","a":"Swedenborgsgatan 13","l":"1503","n":"OWL","k":[["Lägenhetsnyckel","2077659"],["Kopieringsoriginal blå","2077659"],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""],["Överlåsnyckel",""]]}
];
