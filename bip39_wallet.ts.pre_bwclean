// ============================================================================
// KASVILLAGE — BIP39 + BIP44 KEY DERIVATION (STEP 1)
// ============================================================================
// Pure TypeScript — no native deps beyond expo-crypto (PBKDF2) and
// @noble/secp256k1 (already in package.json) for secp256k1 math.
//
// Pipeline:
//   avatar answers
//       ↓ generateIdentityHash() [existing, in ONBOARDING.tsx]
//   identityHash (64 hex chars = 32 bytes)
//       ↓ identityHashToEntropy()
//   entropy (16 bytes = 128 bits → 12-word mnemonic)
//       ↓ entropyToMnemonic()
//   mnemonic (12 BIP39 words)
//       ↓ mnemonicToSeed()  [PBKDF2-SHA512, passphrase = "" (empty = standard BIP39, portable)]
//   seed (64 bytes)
//       ↓ deriveKaspaKey()  [BIP44 m/44'/111111'/0'/0/0]
//   { privateKeyHex, publicKeyHex, kaspaAddress }
//
// Schema version is baked into the hash prefix ("KV_AVATAR_V3:") so a
// schema change never silently re-derives a different key.
// ============================================================================

import * as Crypto from 'expo-crypto';
import * as secp from '@noble/secp256k1';

// ============================================================================
// SECTION 1: BIP39 WORDLIST (2048 words — English)
// ============================================================================
// Full BIP39 English wordlist embedded inline.
// Source: https://github.com/trezor/python-mnemonic/blob/master/src/mnemonic/wordlist/english.txt
// ============================================================================

const WORDLIST: string[] = [
"abandon","ability","able","about","above","absent","absorb","abstract","absurd","abuse",
"access","accident","account","accuse","achieve","acid","acoustic","acquire","across","act",
"action","actor","actress","actual","adapt","add","addict","address","adjust","admit",
"adult","advance","advice","aerobic","affair","afford","afraid","again","age","agent",
"agree","ahead","aim","air","airport","aisle","alarm","album","alcohol","alert",
"alien","all","alley","allow","almost","alone","alpha","already","also","alter",
"always","amateur","amazing","among","amount","amused","analyst","anchor","ancient","anger",
"angle","angry","animal","ankle","announce","annual","another","answer","antenna","antique",
"anxiety","any","apart","apology","appear","apple","approve","april","arch","arctic",
"area","arena","argue","arm","armed","armor","army","around","arrange","arrest",
"arrive","arrow","art","artefact","artist","artwork","ask","aspect","assault","asset",
"assist","assume","asthma","athlete","atom","attack","attend","attitude","attract","auction",
"audit","august","aunt","author","auto","autumn","average","avocado","avoid","awake",
"aware","away","awesome","awful","awkward","axis","baby","bachelor","bacon","badge",
"bag","balance","balcony","ball","bamboo","banana","banner","bar","barely","bargain",
"barrel","base","basic","basket","battle","beach","bean","beauty","because","become",
"beef","before","begin","behave","behind","believe","below","belt","bench","benefit",
"best","betray","better","between","beyond","bicycle","bid","bike","bind","biology",
"bird","birth","bitter","black","blade","blame","blanket","blast","bleak","bless",
"blind","blood","blossom","blouse","blue","blur","blush","board","boat","body",
"boil","bomb","bone","bonus","book","boost","border","boring","borrow","boss",
"bottom","bounce","box","boy","bracket","brain","brand","brass","brave","bread",
"breeze","brick","bridge","brief","bright","bring","brisk","broccoli","broken","bronze",
"broom","brother","brown","brush","bubble","buddy","budget","buffalo","build","bulb",
"bulk","bullet","bundle","bunker","burden","burger","burst","bus","business","busy",
"butter","buyer","buzz","cabbage","cabin","cable","cactus","cage","cake","call",
"calm","camera","camp","can","canal","cancel","candy","cannon","canoe","canvas",
"canyon","capable","capital","captain","car","carbon","card","cargo","carpet","carry",
"cart","case","cash","casino","castle","casual","cat","catalog","catch","category",
"cattle","caught","cause","caution","cave","ceiling","celery","cement","census","century",
"cereal","certain","chair","chalk","champion","change","chaos","chapter","charge","chase",
"chat","cheap","check","cheese","chef","cherry","chest","chicken","chief","child",
"chimney","choice","choose","chronic","chuckle","chunk","churn","cigar","cinnamon","circle",
"citizen","city","civil","claim","clap","clarify","claw","clay","clean","clerk",
"clever","click","client","cliff","climb","clinic","clip","clock","clog","close",
"cloth","cloud","clown","club","clump","cluster","clutch","coach","coast","coconut",
"code","coffee","coil","coin","collect","color","column","combine","come","comfort",
"comic","common","company","concert","conduct","confirm","congress","connect","consider","control",
"convince","cook","cool","copper","copy","coral","core","corn","correct","cost",
"cotton","couch","country","couple","course","cousin","cover","coyote","crack","cradle",
"craft","cram","crane","crash","crater","crawl","crazy","cream","credit","creek",
"crew","cricket","crime","crisp","critic","crop","cross","crouch","crowd","crucial",
"cruel","cruise","crumble","crunch","crush","cry","crystal","cube","culture","cup",
"cupboard","curious","current","curtain","curve","cushion","custom","cute","cycle","dad",
"damage","damp","dance","danger","daring","dash","daughter","dawn","day","deal",
"debate","debris","decade","december","decide","decline","decorate","decrease","deer","defense",
"define","defy","degree","delay","deliver","demand","demise","denial","dentist","deny",
"depart","depend","deposit","depth","deputy","derive","describe","desert","design","desk",
"despair","destroy","detail","detect","develop","device","devote","diagram","dial","diamond",
"diary","dice","diesel","diet","differ","digital","dignity","dilemma","dinner","dinosaur",
"direct","dirt","disagree","discover","disease","dish","dismiss","disorder","display","distance",
"divert","divide","divorce","dizzy","doctor","document","dog","doll","dolphin","domain",
"donate","donkey","donor","door","dose","double","dove","draft","dragon","drama",
"drastic","draw","dream","dress","drift","drill","drink","drip","drive","drop",
"drum","dry","duck","dumb","dune","during","dust","dutch","duty","dwarf",
"dynamic","eager","eagle","early","earn","earth","easily","east","easy","echo",
"ecology","economy","edge","edit","educate","effort","egg","eight","either","elbow",
"elder","electric","elegant","element","elephant","elevator","elite","else","embark","embody",
"embrace","emerge","emotion","employ","empower","empty","enable","enact","end","endless",
"endorse","enemy","energy","enforce","engage","engine","enhance","enjoy","enlist","enough",
"enrich","enroll","ensure","enter","entire","entry","envelope","episode","equal","equip",
"era","erase","erode","erosion","error","erupt","escape","essay","essence","estate",
"eternal","ethics","evidence","evil","evoke","evolve","exact","example","excess","exchange",
"excite","exclude","excuse","execute","exercise","exhaust","exhibit","exile","exist","exit",
"exotic","expand","expect","expire","explain","expose","express","extend","extra","eye",
"eyebrow","fabric","face","faculty","fade","faint","faith","fall","false","fame",
"family","famous","fan","fancy","fantasy","farm","fashion","fat","fatal","father",
"fatigue","fault","favorite","feature","february","federal","fee","feed","feel","female",
"fence","festival","fetch","fever","few","fiber","fiction","field","figure","file",
"film","filter","final","find","fine","finger","finish","fire","firm","first",
"fiscal","fish","fit","fitness","fix","flag","flame","flash","flat","flavor",
"flee","flight","flip","float","flock","floor","flower","fluid","flush","fly",
"foam","focus","fog","foil","fold","follow","food","foot","force","forest",
"forget","fork","fortune","forum","forward","fossil","foster","found","fox","fragile",
"frame","frequent","fresh","friend","fringe","frog","front","frost","frown","frozen",
"fruit","fuel","fun","funny","furnace","fury","future","gadget","gain","galaxy",
"gallery","game","gap","garage","garbage","garden","garlic","garment","gas","gasp",
"gate","gather","gauge","gaze","general","genius","genre","gentle","genuine","gesture",
"ghost","giant","gift","giggle","ginger","giraffe","girl","give","glad","glance",
"glare","glass","glide","glimpse","globe","gloom","glory","glove","glow","glue",
"goat","goddess","gold","good","goose","gorilla","gospel","gossip","govern","gown",
"grab","grace","grain","grant","grape","grass","gravity","great","green","grid",
"grief","grit","grocery","group","grow","grunt","guard","guess","guide","guilt",
"guitar","gun","gym","habit","hair","half","hammer","hamster","hand","happy",
"harbor","hard","harsh","harvest","hat","have","hawk","hazard","head","health",
"heart","heavy","hedgehog","height","hello","helmet","help","hen","hero","hidden",
"high","hill","hint","hip","hire","history","hobby","hockey","hold","hole",
"holiday","hollow","home","honey","hood","hope","horn","horror","horse","hospital",
"host","hotel","hour","hover","hub","huge","human","humble","humor","hundred",
"hungry","hunt","hurdle","hurry","hurt","husband","hybrid","ice","icon","idea",
"identify","idle","ignore","ill","illegal","illness","image","imitate","immense","immune",
"impact","impose","improve","impulse","inch","include","income","increase","index","indicate",
"indoor","industry","infant","inflict","inform","inhale","inherit","initial","inject","injury",
"inmate","inner","innocent","input","inquiry","insane","insect","inside","inspire","install",
"intact","interest","into","invest","invite","involve","iron","island","isolate","issue",
"item","ivory","jacket","jaguar","jar","jazz","jealous","jeans","jelly","jewel",
"job","join","joke","journey","joy","judge","juice","jump","jungle","junior",
"junk","just","kangaroo","keen","keep","ketchup","key","kick","kid","kidney",
"kind","kingdom","kiss","kit","kitchen","kite","kitten","kiwi","knee","knife",
"knock","know","lab","label","labor","ladder","lady","lake","lamp","language",
"laptop","large","later","latin","laugh","laundry","lava","law","lawn","lawsuit",
"layer","lazy","leader","leaf","learn","leave","lecture","left","leg","legal",
"legend","leisure","lemon","lend","length","lens","leopard","lesson","letter","level",
"liar","liberty","library","license","life","lift","light","like","limb","limit",
"link","lion","liquid","list","little","live","lizard","load","loan","lobster",
"local","lock","logic","lonely","long","loop","lottery","loud","lounge","love",
"loyal","lucky","luggage","lumber","lunar","lunch","luxury","lyrics","machine","mad",
"magic","magnet","maid","mail","main","major","make","mammal","man","manage",
"mandate","mango","mansion","manual","maple","marble","march","margin","marine","market",
"marriage","mask","mass","master","match","material","math","matrix","matter","maximum",
"maze","meadow","mean","measure","meat","mechanic","medal","media","melody","melt",
"member","memory","mention","menu","mercy","merge","merit","merry","mesh","message",
"metal","method","middle","midnight","milk","million","mimic","mind","minimum","minor",
"minute","miracle","mirror","misery","miss","mistake","mix","mixed","mixture","mobile",
"model","modify","mom","moment","monitor","monkey","monster","month","moon","moral",
"more","morning","mosquito","mother","motion","motor","mountain","mouse","move","movie",
"much","muffin","mule","multiply","muscle","museum","mushroom","music","must","mutual",
"myself","mystery","myth","naive","name","napkin","narrow","nasty","nation","nature",
"near","neck","need","negative","neglect","neither","nephew","nerve","nest","net",
"network","neutral","never","news","next","nice","night","noble","noise","nominee",
"noodle","normal","north","nose","notable","note","nothing","notice","novel","now",
"nuclear","number","nurse","nut","oak","obey","object","oblige","obscure","observe",
"obtain","obvious","occur","ocean","october","odor","off","offer","office","often",
"oil","okay","old","olive","olympic","omit","once","one","onion","online",
"only","open","opera","opinion","oppose","option","orange","orbit","orchard","order",
"ordinary","organ","orient","original","orphan","ostrich","other","outdoor","outer","output",
"outside","oval","oven","over","own","owner","oxygen","oyster","ozone","pact",
"paddle","page","pair","palace","palm","panda","panel","panic","panther","paper",
"parade","parent","park","parrot","party","pass","patch","path","patient","patrol",
"pattern","pause","pave","payment","peace","peanut","pear","peasant","pelican","pen",
"penalty","pencil","people","pepper","perfect","permit","person","pet","phone","photo",
"phrase","physical","piano","picnic","picture","piece","pig","pigeon","pill","pilot",
"pink","pioneer","pipe","pistol","pitch","pizza","place","planet","plastic","plate",
"play","please","pledge","pluck","plug","plunge","poem","poet","point","polar",
"pole","police","pond","pony","pool","popular","portion","position","possible","post",
"potato","pottery","poverty","powder","power","practice","praise","predict","prefer","prepare",
"present","pretty","prevent","price","pride","primary","print","priority","prison","private",
"prize","problem","process","produce","profit","program","project","promote","proof","property",
"prosper","protect","proud","provide","public","pudding","pull","pulp","pulse","pumpkin",
"punch","pupil","puppy","purchase","purity","purpose","purse","push","put","puzzle",
"pyramid","quality","quantum","quarter","question","quick","quit","quiz","quote","rabbit",
"raccoon","race","rack","radar","radio","rail","rain","raise","rally","ramp",
"ranch","random","range","rapid","rare","rate","rather","raven","raw","razor",
"ready","real","reason","rebel","rebuild","recall","receive","recipe","record","recycle",
"reduce","reflect","reform","refuse","region","regret","regular","reject","relax","release",
"relief","rely","remain","remember","remind","remove","render","renew","rent","reopen",
"repair","repeat","replace","report","require","rescue","resemble","resist","resource","response",
"result","retire","retreat","return","reunion","reveal","review","reward","rhythm","rib",
"ribbon","rice","rich","ride","ridge","rifle","right","rigid","ring","riot",
"ripple","risk","ritual","rival","river","road","roast","robot","robust","rocket",
"romance","roof","rookie","room","rose","rotate","rough","round","route","royal",
"rubber","rude","rug","rule","run","runway","rural","sad","saddle","sadness",
"safe","sail","salad","salmon","salon","salt","salute","same","sample","sand",
"satisfy","satoshi","sauce","sausage","save","say","scale","scan","scare","scatter",
"scene","scheme","school","science","scissors","scorpion","scout","scrap","screen","script",
"scrub","sea","search","season","seat","second","secret","section","security","seed",
"seek","segment","select","sell","seminar","senior","sense","sentence","series","service",
"session","settle","setup","seven","shadow","shaft","shallow","share","shed","shell",
"sheriff","shield","shift","shine","ship","shiver","shock","shoe","shoot","shop",
"short","shoulder","shove","shrimp","shrug","shuffle","shy","sibling","sick","side",
"siege","sight","sign","silent","silk","silly","silver","similar","simple","since",
"sing","siren","sister","situate","six","size","skate","sketch","ski","skill",
"skin","skirt","skull","slab","slam","sleep","slender","slice","slide","slight",
"slim","slogan","slot","slow","slush","small","smart","smile","smoke","smooth",
"snack","snake","snap","sniff","snow","soap","soccer","social","sock","soda",
"soft","solar","soldier","solid","solution","solve","someone","song","soon","sorry",
"sort","soul","sound","soup","source","south","space","spare","spatial","spawn",
"speak","special","speed","spell","spend","sphere","spice","spider","spike","spin",
"spirit","split","spoil","sponsor","spoon","sport","spot","spray","spread","spring",
"spy","square","squeeze","squirrel","stable","stadium","staff","stage","stairs","stamp",
"stand","start","state","stay","steak","steel","stem","step","stereo","stick",
"still","sting","stock","stomach","stone","stool","story","stove","strategy","street",
"strike","strong","struggle","student","stuff","stumble","style","subject","submit","subway",
"success","such","sudden","suffer","sugar","suggest","suit","summer","sun","sunny",
"sunset","super","supply","supreme","sure","surface","surge","surprise","surround","survey",
"suspect","sustain","swallow","swamp","swap","swarm","swear","sweet","swift","swim",
"swing","switch","sword","symbol","symptom","syrup","system","table","tackle","tag",
"tail","talent","talk","tank","tape","target","task","taste","tattoo","taxi",
"teach","team","tell","ten","tenant","tennis","tent","term","test","text",
"thank","that","theme","then","theory","there","they","thing","this","thought",
"three","thrive","throw","thumb","thunder","ticket","tide","tiger","tilt","timber",
"time","tiny","tip","tired","tissue","title","toast","tobacco","today","toddler",
"toe","together","toilet","token","tomato","tomorrow","tone","tongue","tonight","tool",
"tooth","top","topic","topple","torch","tornado","tortoise","toss","total","tourist",
"toward","tower","town","toy","track","trade","traffic","tragic","train","transfer",
"trap","trash","travel","tray","treat","tree","trend","trial","tribe","trick",
"trigger","trim","trip","trophy","trouble","truck","true","truly","trumpet","trust",
"truth","try","tube","tuition","tumble","tuna","tunnel","turkey","turn","turtle",
"twelve","twenty","twice","twin","twist","two","type","typical","ugly","umbrella",
"unable","unaware","uncle","uncover","under","undo","unfair","unfold","unhappy","uniform",
"unique","unit","universe","unknown","unlock","until","unusual","unveil","update","upgrade",
"uphold","upon","upper","upset","urban","urge","usage","use","used","useful",
"useless","usual","utility","vacant","vacuum","vague","valid","valley","valve","van",
"vanish","vapor","various","vast","vault","vehicle","velvet","vendor","venture","venue",
"verb","verify","version","very","vessel","veteran","viable","vibrant","vicious","victory",
"video","view","village","vintage","violin","virtual","virus","visa","visit","visual",
"vital","vivid","vocal","voice","void","volcano","volume","vote","voyage","wage",
"wagon","wait","walk","wall","walnut","want","warfare","warm","warrior","wash",
"wasp","waste","water","wave","way","wealth","weapon","wear","weasel","weather",
"web","wedding","weekend","weird","welcome","west","wet","whale","what","wheat",
"wheel","when","where","whip","whisper","wide","width","wife","wild","will",
"win","window","wine","wing","wink","winner","winter","wire","wisdom","wise",
"wish","witness","wolf","woman","wonder","wood","wool","word","work","world",
"worry","worth","wrap","wreck","wrestle","wrist","write","wrong","yard","year",
"yellow","you","young","youth","zebra","zero","zone","zoo"
];

// ============================================================================
// SECTION 2: CHECKSUM UTILITIES
// ============================================================================

function bytesToBits(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(2).padStart(8, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// SECTION 3: ENTROPY → MNEMONIC
// ============================================================================

/**
 * Convert 16 bytes (128 bits) of entropy to a 12-word BIP39 mnemonic.
 * Checksum = first 4 bits of SHA256(entropy).
 * Total bits = 128 + 4 = 132 = 12 × 11.
 */
export async function entropyToMnemonic(entropyBytes: Uint8Array): Promise<string> {
  if (entropyBytes.length !== 16) {
    throw new Error('entropyToMnemonic requires exactly 16 bytes (128 bits)');
  }

  // SHA256 checksum
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToHex(entropyBytes),
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const checksumByte = parseInt(hashHex.slice(0, 2), 16);
  const checksumBits = checksumByte.toString(2).padStart(8, '0').slice(0, 4);

  const bits = bytesToBits(entropyBytes) + checksumBits; // 132 bits

  const words: string[] = [];
  for (let i = 0; i < 12; i++) {
    const chunk = bits.slice(i * 11, (i + 1) * 11);
    const index = parseInt(chunk, 2);
    words.push(WORDLIST[index]);
  }

  return words.join(' ');
}

/**
 * Validate a 12-word BIP39 mnemonic.
 */
export async function validateMnemonic(mnemonic: string): Promise<boolean> {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  if (words.length !== 12) return false;

  for (const word of words) {
    if (!WORDLIST.includes(word)) return false;
  }

  // Reconstruct bits
  const bits = words.map(w => {
    const idx = WORDLIST.indexOf(w);
    return idx.toString(2).padStart(11, '0');
  }).join('');

  const entropyBits = bits.slice(0, 128);
  const checksumBits = bits.slice(128);

  // Reconstruct entropy bytes
  const entropyBytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    entropyBytes[i] = parseInt(entropyBits.slice(i * 8, (i + 1) * 8), 2);
  }

  // Verify checksum
  const hashHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytesToHex(entropyBytes),
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  const expectedChecksum = parseInt(hashHex.slice(0, 2), 16)
    .toString(2).padStart(8, '0').slice(0, 4);

  return checksumBits === expectedChecksum;
}

/**
 * Inverse of entropyToMnemonic: recover the 16-byte entropy from a 12-word
 * mnemonic. Pure wordlist math — synchronous, no crypto. Does NOT verify the
 * checksum (use validateMnemonic() for that). Throws on wrong word count or an
 * unknown word.
 */
export function mnemonicToEntropy(mnemonic: string): Uint8Array {
  const words = mnemonic.trim().toLowerCase().split(/\s+/);
  if (words.length !== 12) {
    throw new Error(`mnemonicToEntropy requires 12 words, got ${words.length}`);
  }
  let bits = '';
  for (const w of words) {
    const idx = WORDLIST.indexOf(w);
    if (idx < 0) throw new Error(`unknown BIP39 word: ${w}`);
    bits += idx.toString(2).padStart(11, '0');
  }
  const entropyBits = bits.slice(0, 128); // drop the 4 checksum bits
  const entropy = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    entropy[i] = parseInt(entropyBits.slice(i * 8, (i + 1) * 8), 2);
  }
  return entropy;
}

// ============================================================================
// SECTION 4: MNEMONIC → SEED (BIP39 PBKDF2)
// ============================================================================

/**
 * BIP39: derive 64-byte seed from mnemonic using PBKDF2-HMAC-SHA512.
 * passphrase = "kasvillage" (domain separation — same avatar on another
 * platform derives a different key).
 */
export async function mnemonicToSeed(
  mnemonic: string,
  passphrase = ''
): Promise<Uint8Array> {
  const mnemonicNFKD = mnemonic.normalize('NFKD');
  const saltNFKD = ('mnemonic' + passphrase).normalize('NFKD');

  // expo-crypto supports PBKDF2
  const keyHex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA512,
    mnemonicNFKD + '|PBKDF2|' + saltNFKD + '|2048',
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // Note: expo-crypto doesn't expose PBKDF2 directly.
  // We implement PBKDF2-HMAC-SHA512 using our HMAC-SHA512 below.
  return pbkdf2HmacSha512(
    new TextEncoder().encode(mnemonicNFKD),
    new TextEncoder().encode(saltNFKD),
    2048,
    64
  );
}

// ============================================================================
// SECTION 5: HMAC-SHA512 + PBKDF2 (pure JS)
// ============================================================================

// SHA-512 constants
const SHA512_K = [
  0x428a2f98n, 0xd728ae22n, 0x71374491n, 0x23ef65cdn, 0xb5c0fbcfn, 0xec4d3b2fn, 0xe9b5dba5n, 0x8189dbbcn,
  0x3956c25bn, 0xf348b538n, 0x59f111f1n, 0xb605d019n, 0x923f82a4n, 0xaf194f9bn, 0xab1c5ed5n, 0xda6d8118n,
  0xd807aa98n, 0xa3030242n, 0x12835b01n, 0x45706fben, 0x243185ben, 0x4ee4b28cn, 0x550c7dc3n, 0xd5ffb4e2n,
  0x72be5d74n, 0xf27b896fn, 0x80deb1fen, 0x3b1696b1n, 0x9bdc06a7n, 0x25c71235n, 0xc19bf174n, 0xcf692694n,
  0xe49b69c1n, 0x9ef14ad2n, 0xefbe4786n, 0x384f25e3n, 0x0fc19dc6n, 0x8b8cd5b5n, 0x240ca1ccn, 0x77ac9c65n,
  0x2de92c6fn, 0x592b0275n, 0x4a7484aan, 0x6ea6e483n, 0x5cb0a9dcn, 0xbd41fbd4n, 0x76f988dan, 0x831153b5n,
  0x983e5152n, 0xee66dfabn, 0xa831c66dn, 0x2db43210n, 0xb00327c8n, 0x98fb213fn, 0xbf597fc7n, 0xbeef0ee4n,
  0xc6e00bf3n, 0x3da88fc2n, 0xd5a79147n, 0x930aa725n, 0x06ca6351n, 0xe003826fn, 0x14292967n, 0x0a0e6e70n,
  0x27b70a85n, 0x46d22ffcn, 0x2e1b2138n, 0x5c26c926n, 0x4d2c6dfcn, 0x5ac42aedn, 0x53380d13n, 0x9d95b3dfn,
  0x650a7354n, 0x8baf63den, 0x766a0abbn, 0x3c77b2a8n, 0x81c2c92en, 0x47edaee6n, 0x92722c85n, 0x1482353bn,
  0xa2bfe8a1n, 0x4cf10364n, 0xa81a664bn, 0xbc423001n, 0xc24b8b70n, 0xd0f89791n, 0xc76c51a3n, 0x0654be30n,
  0xd192e819n, 0xd6ef5218n, 0xd6990624n, 0x5565a910n, 0xf40e3585n, 0x5771202an, 0x106aa070n, 0x32bbd1b8n,
  0x19a4c116n, 0xb8d2d0c8n, 0x1e376c08n, 0x5141ab53n, 0x2748774cn, 0xdf8eeb99n, 0x34b0bcb5n, 0xe19b48a8n,
  0x391c0cb3n, 0xc5c95a63n, 0x4ed8aa4an, 0xe3418acbn, 0x5b9cca4fn, 0x7763e373n, 0x682e6ff3n, 0xd6b2b8a3n,
  0x748f82een, 0x5defb2fcn, 0x78a5636fn, 0x43172f60n, 0x84c87814n, 0xa1f0ab72n, 0x8cc70208n, 0x1a6439ecn,
  0x90befffan, 0x23631e28n, 0xa4506cebn, 0xde82bde9n, 0xbef9a3f7n, 0xb2c67915n, 0xc67178f2n, 0xe372532bn,
  0xca273ecen, 0xea26619cn, 0xd186b8c7n, 0x21c0c207n, 0xeada7dd6n, 0xcde0eb1en, 0xf57d4f7fn, 0xee6ed178n,
  0x06f067aan, 0x72176fban, 0x0a637dc5n, 0xa2c898a6n, 0x113f9804n, 0xbef90daen, 0x1b710b35n, 0x131c471bn,
  0x28db77f5n, 0x23047d84n, 0x32caab7bn, 0x40c72493n, 0x3c9ebe0an, 0x15c9bebcn, 0x431d67c4n, 0x9c100d4cn,
  0x4cc5d4ben, 0xcb3e42b6n, 0x597f299cn, 0xfc657e2an, 0x5fcb6fabn, 0x3ad6faecn, 0x6c44198cn, 0x4a475817n,
];

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & 0xFFFFFFFFFFFFFFFFn;
}

function sha512Block(h: bigint[], w: bigint[]): bigint[] {
  let [a, b, c, d, e, f, g, hh] = h;
  const M = 0xFFFFFFFFFFFFFFFFn;

  for (let t = 0; t < 80; t++) {
    if (t >= 16) {
      const s0 = rotr64(w[t-15], 1n) ^ rotr64(w[t-15], 8n) ^ (w[t-15] >> 7n);
      const s1 = rotr64(w[t-2], 19n) ^ rotr64(w[t-2], 61n) ^ (w[t-2] >> 6n);
      w[t] = (w[t-16] + s0 + w[t-7] + s1) & M;
    }
    const S1 = rotr64(e, 14n) ^ rotr64(e, 18n) ^ rotr64(e, 41n);
    const ch = (e & f) ^ (~e & M & g);
    const temp1 = (hh + S1 + ch + SHA512_K[t] + w[t]) & M;
    const S0 = rotr64(a, 28n) ^ rotr64(a, 34n) ^ rotr64(a, 39n);
    const maj = (a & b) ^ (a & c) ^ (b & c);
    const temp2 = (S0 + maj) & M;
    hh = g; g = f; f = e; e = (d + temp1) & M;
    d = c; c = b; b = a; a = (temp1 + temp2) & M;
  }

  return [
    (h[0] + a) & M, (h[1] + b) & M, (h[2] + c) & M, (h[3] + d) & M,
    (h[4] + e) & M, (h[5] + f) & M, (h[6] + g) & M, (h[7] + hh) & M,
  ];
}

function sha512(data: Uint8Array): Uint8Array {
  const M = 0xFFFFFFFFFFFFFFFFn;
  const bitLen = BigInt(data.length * 8);

  // Padding
  const padded: number[] = [...data, 0x80];
  while (padded.length % 128 !== 112) padded.push(0);
  for (let i = 7; i >= 0; i--) padded.push(0); // 64-bit length high (always 0)
  for (let i = 7; i >= 0; i--) padded.push(Number((bitLen >> BigInt(i * 8)) & 0xFFn));

  let h: bigint[] = [
    0x6a09e667f3bcc908n, 0xbb67ae8584caa73bn, 0x3c6ef372fe94f82bn, 0xa54ff53a5f1d36f1n,
    0x510e527fade682d1n, 0x9b05688c2b3e6c1fn, 0x1f83d9abfb41bd6bn, 0x5be0cd19137e2179n,
  ];

  for (let i = 0; i < padded.length; i += 128) {
    const w: bigint[] = [];
    for (let j = 0; j < 16; j++) {
      let val = 0n;
      for (let k = 0; k < 8; k++) {
        val = (val << 8n) | BigInt(padded[i + j * 8 + k]);
      }
      w.push(val);
    }
    for (let j = 16; j < 80; j++) w.push(0n);
    h = sha512Block(h, w);
  }

  const out = new Uint8Array(64);
  for (let i = 0; i < 8; i++) {
    for (let j = 7; j >= 0; j--) {
      out[i * 8 + (7 - j)] = Number((h[i] >> BigInt(j * 8)) & 0xFFn);
    }
  }
  return out;
}

function hmacSha512(key: Uint8Array, data: Uint8Array): Uint8Array {
  const BLOCK = 128;
  let k = key.length > BLOCK ? sha512(key) : new Uint8Array(key);
  if (k.length < BLOCK) {
    const tmp = new Uint8Array(BLOCK);
    tmp.set(k);
    k = tmp;
  }
  const ipad = new Uint8Array(BLOCK + data.length);
  const opad = new Uint8Array(BLOCK + 64);
  for (let i = 0; i < BLOCK; i++) { ipad[i] = k[i] ^ 0x36; opad[i] = k[i] ^ 0x5c; }
  ipad.set(data, BLOCK);
  const inner = sha512(ipad);
  opad.set(inner, BLOCK);
  return sha512(opad);
}

async function pbkdf2HmacSha512(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  dkLen: number
): Promise<Uint8Array> {
  const hLen = 64;
  const blocks = Math.ceil(dkLen / hLen);
  const dk = new Uint8Array(dkLen);

  for (let i = 1; i <= blocks; i++) {
    const u1salt = new Uint8Array(salt.length + 4);
    u1salt.set(salt);
    u1salt[salt.length]     = (i >> 24) & 0xff;
    u1salt[salt.length + 1] = (i >> 16) & 0xff;
    u1salt[salt.length + 2] = (i >> 8)  & 0xff;
    u1salt[salt.length + 3] =  i        & 0xff;

    let u = hmacSha512(password, u1salt);
    let f = new Uint8Array(u);

    for (let j = 1; j < iterations; j++) {
      u = hmacSha512(password, u);
      for (let k = 0; k < hLen; k++) f[k] ^= u[k];
    }

    dk.set(f.slice(0, Math.min(hLen, dkLen - (i - 1) * hLen)), (i - 1) * hLen);
  }
  return dk;
}

// ============================================================================
// SECTION 6: BIP32 HD KEY DERIVATION
// ============================================================================

interface HDKey {
  privateKey: Uint8Array;  // 32 bytes
  chainCode:  Uint8Array;  // 32 bytes
}

function ser32(n: number): Uint8Array {
  return new Uint8Array([(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]);
}

function serP(point: Uint8Array): Uint8Array {
  return point; // Already 33-byte compressed
}

/**
 * BIP32 child key derivation (hardened when index >= 0x80000000).
 */
function deriveChild(parent: HDKey, index: number): HDKey {
  const hardened = index >= 0x80000000;
  let data: Uint8Array;

  if (hardened) {
    data = new Uint8Array(37);
    data[0] = 0x00;
    data.set(parent.privateKey, 1);
    data.set(ser32(index), 33);
  } else {
    const pubKey = secp.getPublicKey(parent.privateKey, true);
    data = new Uint8Array(37);
    data.set(serP(pubKey), 0);
    data.set(ser32(index), 33);
  }

  const I = hmacSha512(parent.chainCode, data);
  const IL = I.slice(0, 32);
  const IR = I.slice(32);

  // child private key = (IL + parent.privateKey) mod n
  const n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141n;
  const ilNum = BigInt('0x' + bytesToHex(IL));
  const parNum = BigInt('0x' + bytesToHex(parent.privateKey));
  const childNum = (ilNum + parNum) % n;

  const childKey = hexToBytes(childNum.toString(16).padStart(64, '0'));

  return { privateKey: childKey, chainCode: IR };
}

/**
 * Derive HD key from seed using BIP44 path m/44'/111111'/0'/0/0
 * (Kaspa standard: coin type 111111)
 */
export function deriveKaspaHDKey(seed: Uint8Array): HDKey {
  // Master key
  const I = hmacSha512(new TextEncoder().encode('Bitcoin seed'), seed);
  let node: HDKey = { privateKey: I.slice(0, 32), chainCode: I.slice(32) };

  // m/44'/111111'/0'/0/0
  const path = [
    44   + 0x80000000,  // purpose' (hardened)
    111111 + 0x80000000, // coin type' (Kaspa)
    0    + 0x80000000,  // account' (hardened)
    0,                   // change (external)
    0,                   // address index
  ];

  for (const idx of path) {
    node = deriveChild(node, idx);
  }

  return node;
}

// ============================================================================
// SECTION 7: FULL PIPELINE — identityHash → wallet
// ============================================================================

export interface DerivedWallet {
  mnemonic:       string;    // 12 BIP39 words (for Ledger/Tangem export)
  privateKeyHex:  string;    // 32-byte hex
  publicKeyHex:   string;    // 33-byte compressed hex
  kaspaAddress:   string;    // kaspa:q...
  entropy:        string;    // 16-byte hex (first 16 bytes of identityHash)
}

/**
 * Derive complete wallet from identityHash (output of generateIdentityHash).
 *
 * DETERMINISTIC: same avatar answers → same identityHash → same wallet.
 * SCHEMA-LOCKED: "KV_AVATAR_V3:" prefix means schema changes never
 *                silently derive a different key.
 */
export async function deriveWalletFromIdentityHash(
  identityHashHex: string
): Promise<DerivedWallet> {
  // 1. Use first 16 bytes (128 bits) of SHA256 hash as BIP39 entropy
  const entropy = hexToBytes(identityHashHex.slice(0, 32)); // 32 hex chars = 16 bytes

  // 2. Entropy → 12-word BIP39 mnemonic
  const mnemonic = await entropyToMnemonic(entropy);

  // 3. Mnemonic → 64-byte BIP39 seed (PBKDF2-HMAC-SHA512, 2048 iterations)
  const seed = await mnemonicToSeed(mnemonic, '');

  // 4. Seed → BIP44 HD key (m/44'/111111'/0'/0/0)
  const hdKey = deriveKaspaHDKey(seed);

  // 5. Private key → compressed public key
  const pubKeyBytes = secp.getPublicKey(hdKey.privateKey, true); // 33 bytes compressed

  // 6. Public key → Kaspa address (bech32m, x-only, Schnorr P2PK)
  const xOnly = pubKeyBytes.slice(1); // 32-byte x-coordinate
  const kaspaAddress = xOnlyToKaspaAddress(xOnly);

  return {
    mnemonic,
    privateKeyHex: bytesToHex(hdKey.privateKey),
    publicKeyHex:  bytesToHex(pubKeyBytes),
    kaspaAddress,
    entropy:       bytesToHex(entropy),
  };
}

// ============================================================================
// SECTION 8: KASPA BECH32 ADDRESS (x-only pubkey)
// Correct 40-bit polymod ported from rusty-kaspa/crypto/addresses/src/bech32.rs
// ============================================================================

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function kaspaPolymod(values: number[]): bigint {
  let c = 1n;
  for (const d of values) {
    const c0 = c >> 35n;
    c = ((c & 0x07fffffffffn) << 5n) ^ BigInt(d);
    if (c0 & 0x01n) c ^= 0x98f2bc8e61n;
    if (c0 & 0x02n) c ^= 0x79b76d99e2n;
    if (c0 & 0x04n) c ^= 0xf33e5fb3c4n;
    if (c0 & 0x08n) c ^= 0xae2eabe2a8n;
    if (c0 & 0x10n) c ^= 0x1e4f43e470n;
  }
  return c ^ 1n;
}

function kaspaConv8to5(payload: number[]): number[] {
  const result: number[] = [];
  let buff = 0, bits = 0;
  for (const c of payload) {
    buff = (buff << 8) | c;
    bits += 8;
    while (bits >= 5) { bits -= 5; result.push((buff >> bits) & 31); buff &= (1 << bits) - 1; }
  }
  if (bits > 0) result.push((buff << (5 - bits)) & 31);
  return result;
}

function xOnlyToKaspaAddress(xOnly: Uint8Array, hrp = 'kaspa'): string {
  const fullPayload = [0, ...Array.from(xOnly)];
  const fivebitPayload = kaspaConv8to5(fullPayload);
  const fivebitPrefix = Array.from(hrp).map(c => c.charCodeAt(0) & 0x1f);
  const checksumInput = [...fivebitPrefix, 0, ...fivebitPayload, 0, 0, 0, 0, 0, 0, 0, 0];
  const cs = kaspaPolymod(checksumInput);
  const csBytes: number[] = [];
  for (let i = 4; i >= 0; i--) csBytes.push(Number((cs >> BigInt(i * 8)) & 0xFFn));
  const cs5bit = kaspaConv8to5(csBytes);
  let addr = hrp + ':';
  for (const d of [...fivebitPayload, ...cs5bit]) addr += BECH32_CHARSET[d];
  return addr;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  hexToBytes,
  bytesToHex,
  hmacSha512,
  sha512,
};