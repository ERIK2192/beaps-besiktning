/* Property register: the addresses and apartments behind the two fields on the
 * Property step. Loaded on demand the first time that step is shown, so it costs nothing
 * on a phone that never opens it.
 *
 * Shape:
 *   a  address exactly as it should be written on a report
 *   l  the apartments, each ['number'] or ['number','name']
 *
 * Two sources, merged on the address:
 *   - Nyckellista Pondus Pro: where the apartment numbers and names come from
 *   - the door-code list out of Beaps (Dataverse, bdev_property, taken 2026-09-22):
 *     the fuller list of addresses, 73 of them
 * An address the key list does not cover has an empty apartment list; the field still takes
 * anything typed, so a property missing here is never in the way.
 *
 * The door codes are NOT here. This file is served as-is from a public address, so a code
 * in it is a code anyone who finds the app can read. The list lives in
 * outputs/fastigheter/portkoder.txt, outside the deploy.
 */
window.FASTIGHETER = [
  { a:'Assessorsgatan 4', l:[] },
  { a:'Atterbomsvägen 50', l:[['1202'],['1303'],['1401'],['1403'],['1405'],['1501']] },
  { a:'Banérgatan 10', l:[] },
  { a:'Banérgatan 45B', l:[] },
  { a:'Bergsundsgatan 17', l:[['1202'],['1302']] },
  { a:'Birger Jarlsgatan 101', l:[] },
  { a:'Birger Jarlsgatan 62', l:[] },
  { a:'Brahegatan 35', l:[] },
  { a:'Brantingsgatan 37', l:[] },
  { a:'Brantingsgatan 39', l:[] },
  { a:'Brunnsgatan 7', l:[] },
  { a:'Brännkyrkagatan 50A', l:[] },
  { a:'Dellensvägen 14', l:[] },
  { a:'Dellensvägen 16', l:[] },
  { a:'Dellensvägen 24', l:[] },
  { a:'Drottning Kristinas väg 13', l:[] },
  { a:'Drottninggatan 79', l:[] },
  { a:'Folkungagatan 59A', l:[] },
  { a:'Framnäsbacken 2B', l:[] },
  { a:'Gotlandsgatan 58', l:[] },
  { a:'Grev Turegatan 38', l:[] },
  { a:'Grev Turegatan 65', l:[] },
  { a:'Gumshornsgatan 2B', l:[] },
  { a:'Gumshornsgatan 4', l:[] },
  { a:'Gyllenborgsgatan 10', l:[] },
  { a:'Hägerstensvägen 205', l:[] },
  { a:'Hästholmsvägen 16', l:[['1804']] },
  { a:'Högbergsgatan 30A', l:[['1201']] },
  { a:'Högbergsgatan 65', l:[] },
  { a:'Hövdingagatan 39', l:[] },
  { a:'Jakob Westins gata 8', l:[['1102']] },
  { a:'Karlsviksgatan 5', l:[['1001','VALLMO'],['1201','KORNELL'],['1204','LILJA'],['1205','MIMOSA'],['1302','SKILLA'],['1304','PION'],['1501','IRIS'],['1503','GINST']] },
  { a:'Kolmårdsvägen 21', l:[] },
  { a:'Kommendörsgatan 34', l:[] },
  { a:'Kungsholms Strand 177', l:[] },
  { a:'Kungsholmstorg 6B', l:[['1202']] },
  { a:'Linnégatan 71', l:[] },
  { a:'Malmgårdsvägen 14', l:[] },
  { a:'Nybergsgatan 10', l:[] },
  { a:'Nybergsgatan 6A', l:[['1401','GREVE'],['1403']] },
  { a:'Nybrogatan 46', l:[] },
  { a:'Polhemsgatan 29', l:[['1501'],['1503'],['1701'],['1707']] },
  { a:'Polhemsgatan 6', l:[] },
  { a:'Pontonjärgatan 36', l:[['1002','ROOS'],['1202','AKLEIA'],['1203','MISTEL'],['1301','DAHLIA'],['1303','KLINT'],['1401','FLORA'],['1505','BLOM']] },
  { a:'Renstiernas gata 19', l:[['1504','JEWEL']] },
  { a:'Rimbertsvägen 6', l:[] },
  { a:'Rindögatan 21', l:[] },
  { a:'Rådmansgatan 5', l:[] },
  { a:'Råsundavägen 65', l:[] },
  { a:'Rörstrandsgatan 11', l:[['1103','COLOMBO'],['1202','CIVETTA'],['1203','CIGNO'],['1302'],['1303','DIAMANTE'],['1403','MERLO'],['1502','FALCO'],['1503','FAGIANO'],['1601','GARZETTA'],['1602','GABBIANO']] },
  { a:'Sankt Eriksgatan 53A', l:[] },
  { a:'Sankt Eriksgatan 53B', l:[['1602']] },
  { a:'Sigfridsvägen 25', l:[] },
  { a:'Skeppargatan 49A', l:[['1401'],['1402'],['1501','PIPER']] },
  { a:'Skeppargatan 53', l:[] },
  { a:'Skomakargatan 13', l:[] },
  { a:'Skytteholmsvägen 7B', l:[] },
  { a:'Skytteholmsvägen 7C', l:[] },
  { a:'Smedsbacksgatan 5', l:[] },
  { a:'Storgatan 25', l:[] },
  { a:'Strandvägen 23', l:[] },
  { a:'Styrmansgatan 20', l:[] },
  { a:'Svarvargatan 5', l:[['1204']] },
  { a:'Sveavägen 74', l:[] },
  { a:'Sveavägen 74A', l:[] },
  { a:'Sveavägen 76', l:[] },
  { a:'Sveavägen 76A', l:[] },
  { a:'Swedenborgsgatan 13', l:[] },
  { a:'Thorildsvägen 3', l:[] },
  { a:'Torsten Alms gata 41', l:[['1102']] },
  { a:'Torsten Alms gata 43', l:[['1002','TAMARIND']] },
  { a:'Upplandsgatan 61', l:[['1101','PALMA'],['1103','MIAMI'],['1104','SANTORINI'],['1201','BERLIN'],['1202','TOKYO'],['1203','PARIS'],['1204','MADRID'],['1301','TIRANA'],['1302'],['1303','RIO'],['1304','ROM'],['1401','PETRA'],['1402','PALERMO'],['1403','LONDON'],['1501','lgh 1501'],['1502','lgh 1502'],['1503','lgh 1503'],['1504','lgh 1504']] },
  { a:'Upplandsgatan 61A', l:[['1001','ANKARA'],['1002','ATLANTA'],['1003','SANTIAGO'],['1004'],['1101','MORONI'],['1103','VALLETTA'],['1105','LUXOR'],['1201','VIENNA'],['1202','LIMA'],['1204','COMO'],['1301','DUBLIN'],['1302','POSITANO'],['1303','AMALFI'],['1304','SEVILLA']] },
  { a:'Upplandsgatan 61B', l:[['1001','WELLINGTON']] },
  { a:'Upplandsgatan 61C', l:[['1001','JAKARTA']] },
  { a:'Upplandsgatan 91A', l:[['1102','KNIPA'],['1202','FINCH'],['1203','ANKA'],['1502','TRUT']] },
  { a:'Upplandsgatan 91B', l:[['1001','DOPPING'],['1002','FASAN'],['1101','AND'],['1102','TÄRNA'],['1103','FENIX'],['1104','ORRE'],['1201','FÅGEL'],['1204','GLADA'],['1301','TRAST'],['1302','HÄGER'],['1501']] },
  { a:'Värtavägen 35', l:[] },
  { a:'Värtavägen 37', l:[] },
  { a:'Ängkärrsgatan 14', l:[] },
  { a:'Östermalmsgatan 33', l:[] },
  { a:'Östermalmsgatan 64', l:[] }
];
