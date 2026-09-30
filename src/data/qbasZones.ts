/**
 * Qatar's delivery zones as QBAS knows them — the "cities" of its LogesTechs
 * system, one per numbered zone on Qatar's blue address plates.
 *
 * From the zone report QBAS sent the client (QBAS_HUB_villages, Sep 2026):
 * `[QBAS city id, zone number, name, QBAS area]`. The id is what a booking
 * sends as `cityId`; QBAS's own lookup (`GET /addresses/cities?search=`,
 * company-id 553) returns the same ids — Al Gharrafa 51 is 570481.
 *
 * Kept here rather than fetched: checkout must not depend on QBAS being up,
 * and the zones do not change. If QBAS adds one, add its row here.
 * Names are tidied from the report's ("AL SAAD 38" → "Al Saad"); two rows
 * were corrected by their Arabic name (570528 is Al Wakrah, zone 90).
 */

export type QbasZone = { area: string; id: number; name: string; zone: number }

const ROWS: Array<[number, number, string, string]> = [
  [570532, 1, "Al Jasrah", "DOHA A"],
  [570533, 2, "Al Bidda", "DOHA A"],
  [570534, 3, "Fereej Mohamed Bin Jasim", "DOHA A"],
  [570535, 4, "Mushayrib", "DOHA A"],
  [570538, 5, "Al Najada", "DOHA A"],
  [570536, 5, "Barahat Al Jufairi", "DOHA A"],
  [570537, 5, "Fereej Al Asmakh", "DOHA A"],
  [570539, 6, "Old Al Ghanim", "DOHA A"],
  [570540, 7, "Al Souq", "DOHA A"],
  [570541, 10, "Wadi Al Sail", "DOHA A"],
  [570542, 11, "Rumeilah", "DOHA A"],
  [570543, 14, "Fereej Abdel Aziz", "DOHA A"],
  [570544, 15, "Ad Dawhah Al Jadidah", "DOHA A"],
  [570545, 17, "Al Rufaa", "DOHA A"],
  [570568, 17, "Old Alhitmi", "DOHA B"],
  [570547, 18, "Al Mirqab", "DOHA A"],
  [570546, 18, "As Salatah", "DOHA A"],
  [570569, 19, "Doha Port", "DOHA B"],
  [570548, 20, "Wadi Al Sail", "DOHA A"],
  [570549, 21, "Rumeilah", "DOHA A"],
  [570550, 22, "Fereej Bin Mahmoud", "DOHA A"],
  [570551, 24, "Rawdat Al Khail", "DOHA A"],
  [570553, 25, "Al Mansoura", "DOHA A"],
  [570552, 25, "Fereej Bin Durham", "DOHA A"],
  [570554, 26, "Nejma", "DOHA A"],
  [570555, 27, "Um Ghawilna", "DOHA A"],
  [570570, 28, "Al Khuilifiet", "DOHA B"],
  [570571, 28, "Ras Bou Abood", "DOHA B"],
  [570572, 30, "Douhil", "DOHA B"],
  [570573, 31, "Um Lakhba", "DOHA B"],
  [570575, 32, "Dah Alhamem", "DOHA B"],
  [570574, 32, "Madinet Khalifa North", "DOHA B"],
  [570576, 33, "Al Markhia", "DOHA B"],
  [570577, 34, "Madinet Khalifa South", "DOHA B"],
  [570556, 35, "Freej Kulaib", "DOHA A"],
  [570557, 36, "El Messila", "DOHA A"],
  [570558, 37, "Freej Bin Omran", "DOHA A"],
  [570560, 37, "Hamad Medical Center", "DOHA A"],
  [570559, 37, "New Alhetmi", "DOHA A"],
  [570561, 38, "Al Saad", "DOHA A"],
  [570563, 39, "Freej Al Naser", "DOHA A"],
  [570562, 39, "New Mirqab", "DOHA A"],
  [570564, 40, "New Salath", "DOHA A"],
  [570565, 41, "Nuija", "DOHA A"],
  [570566, 42, "Hilal", "DOHA A"],
  [927138, 43, "Al Maamoura", "المعمورة A"],
  [927139, 44, "Nuija", "DOHA A"],
  [570578, 45, "Old Airport", "DOHA B"],
  [927140, 46, "Al Thumama", "DOHA B"],
  [570579, 47, "Thumama", "DOHA B"],
  [570580, 48, "International Airport", "DOHA B"],
  [570581, 50, "", "DOHA B"],
  [570481, 51, "Al Gharrafa", "ALRAYAN B"],
  [570500, 51, "Al Thameed", "ALRAYAN C"],
  [570485, 51, "Alseej", "ALRAYAN B"],
  [570483, 51, "Azghawa", "ALRAYAN B"],
  [570484, 51, "Beni Hajer", "ALRAYAN B"],
  [570482, 51, "Gharrafat Al Rayyan", "ALRAYAN B"],
  [570499, 51, "Rawdhet Algdeem", "ALRAYAN C"],
  [570486, 52, "Al Luqtaa", "ALRAYAN B"],
  [570488, 52, "Al Shagub", "ALRAYAN B"],
  [570466, 52, "Albedaa", "ALRAYAN A"],
  [570489, 52, "Fereej Al Zaeem", "ALRAYAN B"],
  [570487, 52, "Old Alryaan", "ALRAYAN B"],
  [570491, 53, "Alwajbaa", "ALRAYAN B"],
  [570492, 53, "Muaither", "ALRAYAN B"],
  [570493, 53, "Muraikh", "ALRAYAN B"],
  [570490, 53, "New Al Rayyan", "ALRAYAN B"],
  [570469, 54, "Baaya", "ALRAYAN A"],
  [570471, 54, "Free Al Soudan", "ALRAYAN A"],
  [570467, 54, "Freej Al Amir", "ALRAYAN A"],
  [570468, 54, "Luiab", "ALRAYAN A"],
  [570470, 54, "Mehiraj", "ALRAYAN A"],
  [570473, 55, "Al Azizia", "ALRAYAN A"],
  [570502, 55, "Al Mearad", "ALRAYAN C"],
  [570501, 55, "Al Silya", "ALRAYAN C"],
  [570472, 55, "Al Waab", "ALRAYAN A"],
  [570495, 55, "Bou Sidra", "ALRAYAN B"],
  [570494, 55, "Fereej Al Manaseer", "ALRAYAN B"],
  [570474, 55, "Free Al Ghanem", "ALRAYAN A"],
  [570475, 55, "Freej Al Mura", "ALRAYAN A"],
  [570496, 55, "Muaither", "ALRAYAN B"],
  [570479, 56, "Abou Hamour", "ALRAYAN B"],
  [570477, 56, "Alkhuilifiat", "ALRAYAN A"],
  [570497, 56, "Bou Samra", "ALRAYAN B"],
  [570480, 56, "Ein Khaled", "ALRAYAN B"],
  [570476, 56, "Freej Alnisiri", "ALRAYAN A"],
  [570478, 56, "Maamoura", "ALRAYAN A"],
  [570498, 56, "Mesaimeer", "ALRAYAN B"],
  [570582, 57, "Industriel Area", "DOHA B"],
  [570567, 58, "", "DOHA A"],
  [927141, 60, "Dafna", "DOHA B"],
  [570583, 61, "Al Dafna", "DOHA B"],
  [570584, 61, "Al Qassar", "DOHA B"],
  [570585, 63, "Ounaiza", "DOHA B"],
  [570586, 64, "Lejbait", "DOHA B"],
  [570587, 65, "Ounaiza", "DOHA B"],
  [570588, 66, "Al Qassar", "DOHA B"],
  [570593, 66, "Legtifia", "DOHA C"],
  [570589, 67, "Hazm Al Merkhia", "DOHA B"],
  [570591, 68, "Al Tarfa", "DOHA B"],
  [570590, 68, "Jelaiha", "DOHA B"],
  [570592, 68, "Jeryan Nejaima", "DOHA B"],
  [570451, 69, "Lusail", "ALDAAYAN D"],
  [570457, 70, "Al Daayen", "ALDAAYAN D"],
  [570448, 70, "Al Ebb", "ALDAAYAN C"],
  [570449, 70, "Al Kheesa", "ALDAAYAN C"],
  [570455, 70, "Al Masrouhiya", "ALDAAYAN D"],
  [570454, 70, "Al Sakhama", "ALDAAYAN D"],
  [570444, 70, "Jeryan Jenaihat", "ALDAAYAN C"],
  [570443, 70, "Lubaib", "ALDAAYAN C"],
  [570453, 70, "Rawdat Al Hamama", "ALDAAYAN D"],
  [570458, 70, "Umm Qarn", "ALDAAYAN F"],
  [570452, 70, "Wadi Al Wasaah", "ALDAAYAN D"],
  [570456, 70, "Wadi Lusail", "ALDAAYAN D"],
  [570595, 71, "Al Kharaitiyat", "UMSALAL C"],
  [570594, 71, "Azghawa", "UMSALAL C"],
  [570597, 71, "Bu Fasseela", "UMSALAL F"],
  [570601, 71, "Saina Al-Humaidi", "UMSALAL G"],
  [570599, 71, "Umm Al Amad", "UMSALAL F"],
  [570600, 71, "Umm Ebairiya", "UMSALAL F"],
  [570598, 71, "Umm Salal Ali", "UMSALAL F"],
  [570596, 71, "Umm Salal Mohammed", "UMSALAL C"],
  [570521, 72, "Al Utouriya", "ALSHIHANIA H"],
  [570524, 73, "Al Jumailya", "ALSHIHANIA Z"],
  [570460, 74, "Al Jeryan", "ALKHOR G"],
  [570461, 74, "Al Khor City", "ALKHOR G"],
  [570522, 74, "Al-Shahaniya City", "ALSHIHANIA H"],
  [570459, 74, "Simaisma", "ALKHOR G"],
  [570462, 75, "Al Thakhira", "ALKHOR H"],
  [570463, 75, "Ras Laffan", "ALKHOR Z"],
  [570464, 75, "Umm Birka", "ALKHOR Z"],
  [570465, 76, "Al Ghuwariyah", "ALKHOR Z"],
  [570603, 77, "Ain Sinan", "ALSHAMAL Z"],
  [570605, 77, "Fuwayrit", "ALSHAMAL Z"],
  [570604, 77, "Madinat Al Kaaban", "ALSHAMAL Z"],
  [570606, 78, "Abu Dhalouf", "ALSHAMAL Z"],
  [570608, 78, "Madinat Ash Shamal", "ALSHAMAL Z"],
  [570607, 78, "Zubarah", "ALSHAMAL Z"],
  [570609, 79, "Al Rawis", "ALSHAMAL Z"],
  [819380, 80, "Al Shihaniyah", "ALSHIHANIA H"],
  [570503, 81, "Mebaireek", "ALRAYAN D"],
  [570520, 82, "Rawdat Rashed", "ALSHIHANIA F"],
  [570504, 83, "Al Karaana", "ALRAYAN H"],
  [570525, 84, "Umm Bab", "ALSHIHANIA Z"],
  [570523, 85, "Al Nasraniya", "ALSHIHANIA H"],
  [570526, 86, "Dukhan", "ALSHIHANIA Z"],
  [570528, 90, "Al Wakrah", "ALWAKRA C"],
  [570527, 91, "Al Thumama", "ALWAKRA B"],
  [570602, 91, "Al Wukair", "ALWAKRA D"],
  [570610, 92, "Mesaieed", "ALWAKRA F"],
  [570611, 93, "Mesaieed Industrial Area", "ALWAKRA F"],
  [570530, 94, "Shagra", "ALWAKRA Z"],
  [570529, 95, "Al Kharrara", "ALWAKRA H"],
  [570505, 96, "Abu Samra", "ALRAYAN Z"],
  [570450, 96, "Al Kharayej", "ALDAAYAN D"],
  [570446, 96, "Alegla", "ALDAAYAN C"],
  [570445, 96, "Jabeul Dehlib", "ALDAAYAN C"],
  [570447, 96, "Wadi Albanet", "ALDAAYAN C"],
  [570506, 97, "Sawda Natheel", "ALRAYAN Z"],
  [570531, 98, "Khawr Al Udayd", "ALWAKRA Z"],
]

export const QBAS_ZONES: QbasZone[] = ROWS.map(([id, zone, name, area]) => ({ area, id, name, zone }))

const byId = new Map(QBAS_ZONES.map((z) => [z.id, z]))

export const qbasZone = (id: unknown): QbasZone | undefined => {
  const n = typeof id === 'string' ? Number(id) : id
  return typeof n === 'number' && Number.isInteger(n) ? byId.get(n) : undefined
}

/** "Zone 38 · Al Saad" — how a customer finds theirs: by the number on the plate. */
export const zoneLabel = (zone: Pick<QbasZone, 'name' | 'zone'>): string =>
  zone.name ? `Zone ${zone.zone} · ${zone.name}` : `Zone ${zone.zone}`

/* ------------------------------------------------------ zone → her city -- */

/**
 * Which of her delivery cities (Shop settings → Qatar delivery) a zone is in.
 * Checkout lists only the chosen city's zones, and the server takes the fee's
 * city from the zone, so the price and the courier's area cannot disagree. By QBAS's
 * own area (ALRAYAN B → Al Rayyan …), which follows Qatar's municipalities, as
 * her city table does; the places she prices on their own are named by zone.
 *
 * Far corners take their municipality's fee, as her table has always meant:
 * Mebaireek, Al Karaana, Abu Samra, Sawda Natheel (Al Rayyan, QAR 20) and
 * Al Kharrara, Shagra, Khawr Al Udayd (Al Wakrah, QAR 20). Hers to confirm.
 */
const AREA_CITY: Array<[prefix: string, cityKey: string]> = [
  ['DOHA', 'doha'],
  ['المعمورة', 'doha'], // Al Maamoura 43: QBAS labels this area in Arabic
  ['ALRAYAN', 'al-rayyan'],
  ['ALWAKRA', 'al-wakrah'],
  ['UMSALAL', 'umm-salal'],
  ['ALDAAYAN', 'al-daayen'],
  ['ALKHOR', 'al-khor'],
  ['ALSHAMAL', 'al-shamal'],
  ['ALSHIHANIA', 'al-shahaniya'],
]

const ZONE_CITY: Record<number, string> = {
  570463: 'ras-laffan', // Ras Laffan 75
  570526: 'dukhan', // Dukhan 86
  570610: 'mesaieed', // Mesaieed 92
  570611: 'mesaieed', // Mesaieed Industrial Area 93
}

export const cityKeyForZone = (zone: Pick<QbasZone, 'area' | 'id'>): string =>
  ZONE_CITY[zone.id] ??
  AREA_CITY.find(([prefix]) => zone.area.replace(/\s+/g, '').startsWith(prefix))?.[1] ??
  ''
