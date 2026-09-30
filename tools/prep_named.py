"""Named stars for tap-a-star: position, magnitude, distance (HYG v4.1, CC BY-SA 4.0)."""
import csv, json, os, re
CON = {'And':'Andromeda','Aql':'Aquila','Aqr':'Aquarius','Ari':'Aries','Aur':'Auriga','Boo':'Bootes','Cam':'Camelopardalis','Cas':'Cassiopeia','Cep':'Cepheus','Cet':'Cetus','CMa':'Canis Major','CMi':'Canis Minor','Cnc':'Cancer','Col':'Columba','CrB':'Corona Borealis','Crv':'Corvus','Cyg':'Cygnus','Del':'Delphinus','Dra':'Draco','Eri':'Eridanus','Gem':'Gemini','Her':'Hercules','Hya':'Hydra','Lac':'Lacerta','Leo':'Leo','Lep':'Lepus','Lib':'Libra','LMi':'Leo Minor','Lyn':'Lynx','Lyr':'Lyra','Mon':'Monoceros','Oph':'Ophiuchus','Ori':'Orion','Peg':'Pegasus','Per':'Perseus','Psc':'Pisces','PsA':'Piscis Austrinus','Sco':'Scorpius','Ser':'Serpens','Sge':'Sagitta','Sgr':'Sagittarius','Tau':'Taurus','Tri':'Triangulum','UMa':'Ursa Major','UMi':'Ursa Minor','Vir':'Virgo','Vul':'Vulpecula','Cap':'Capricornus','Crt':'Crater','Cyg ':'Cygnus','Com':'Coma Berenices','CVn':'Canes Venatici','Equ':'Equuleus','Sct':'Scutum','Cru':'Crux','Cen':'Centaurus','Car':'Carina','Vel':'Vela','Pup':'Puppis','Gru':'Grus','Phe':'Phoenix','Lup':'Lupus','Ara':'Ara','TrA':'Triangulum Australe','Pav':'Pavo','Hyi':'Hydrus','Tuc':'Tucana','Ret':'Reticulum','Dor':'Dorado','Pic':'Pictor','Ind':'Indus','Mus':'Musca','Aps':'Apus','Cha':'Chamaeleon','Vol':'Volans','Men':'Mensa','Oct':'Octans','Hor':'Horologium','Cae':'Caelum','For':'Fornax','Scl':'Sculptor','Mic':'Microscopium','Tel':'Telescopium','CrA':'Corona Australis','Nor':'Norma','Cir':'Circinus','Pyx':'Pyxis','Ant':'Antlia','Sex':'Sextans','Lac ':'Lacerta'}
COLOUR = {'O':'blue','B':'blue-white','A':'white','F':'yellow-white','G':'yellow','K':'orange','M':'red'}
OVERRIDE = {'Capella': 'pair of yellow giants', 'Sirius': 'white main-sequence star', 'Polaris': 'yellow-white supergiant'}
def kind(sp):
    sp = sp or ''
    if ':' in sp or 'comp' in sp: return 'star'
    m = re.match(r'([OBAFGKM])', sp)
    if not m: return 'star'
    c = COLOUR[m.group(1)]
    rest = sp[1:]
    if re.search(r'I[ab]|Ia|Ib|(?<![IV])I(?![IV])', rest.split('/')[0][:6]) and 'II' not in rest[:5] and 'V' not in rest[:5]: return c + ' supergiant'
    if 'IV' in rest[:6]: return c + ' subgiant'
    if 'III' in rest[:6]: return c + ' giant'
    if 'II' in rest[:6]: return c + ' bright giant'
    if 'V' in rest[:6]: return c + ' main-sequence star'
    return c + ' star'
out = []
for r in csv.DictReader(open(os.path.expanduser('~/work/data/hyg.csv'))):
    if not r['proper'] or r['proper'] == 'Sol': continue
    mag, dec, dist = float(r['mag']), float(r['dec']), float(r['dist'])
    if mag > 4.3 or dec < -35 or dist <= 0 or dist >= 100000: continue
    ly = dist * 3.26156
    out.append([round(float(r['ra']) * 15, 4), round(dec, 4), round(mag, 2), r['proper'], round(ly, 1 if ly < 20 else 0), CON.get(r['con'], r['con']), OVERRIDE.get(r['proper'], kind(r['spect']))])
out.sort(key=lambda s: s[2])
json.dump(out, open(os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'named.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out)); [print(s) for s in out[:12]]
print([s for s in out if s[3] in ('Deneb','Polaris','Mirfak','Kochab','Schedar')])
