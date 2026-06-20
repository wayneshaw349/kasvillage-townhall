const fs = require('fs');
const f = 'src\\main.rs';
let text = fs.readFileSync(f, 'utf8');

const oldBuy = `    fn test_traits_can_buy() {
        let mut t = CitadelTraits::default();
        for _ in 0..8 { t.name = true; t.class = true; t.race = true; t.occupation = true;
                        t.origin_story = true; t.defining_moment = true; t.formative_memory = true;
                        t.life_philosophy = true; }
        assert!(!t.can_buy()); // 8 traits
        t.personality = true;
        assert!(t.can_buy()); // 9 traits
    }`;

const newBuy = `    fn test_traits_can_buy() {
        let mut t = CitadelTraits::default();
        t.name = true; t.class = true; t.race = true; t.occupation = true;
        assert!(!t.can_buy()); // 4 traits < 5
        t.origin_story = true;
        assert!(t.can_buy()); // 5 traits
    }`;

const oldSell = `    fn test_traits_can_sell() {
        let mut t = CitadelTraits::default();
        t.name = true; t.class = true; t.race = true; t.occupation = true;
        t.origin_story = true; t.defining_moment = true; t.formative_memory = true;
        t.life_philosophy = true; t.personality = true; t.weakness = true;
        t.signature_move = true; t.voice_line = true;
        assert!(!t.can_sell()); // 12 traits
        t.power_spike = true;
        assert!(t.can_sell()); // 13 traits
    }`;

const newSell = `    fn test_traits_can_sell() {
        let mut t = CitadelTraits::default();
        t.name = true; t.class = true; t.race = true; t.occupation = true;
        t.origin_story = true;
        assert!(!t.can_sell()); // 5 traits < 6
        t.defining_moment = true;
        assert!(t.can_sell()); // 6 traits
    }`;

let fixes = 0;
if (text.includes(oldBuy)) { text = text.replace(oldBuy, newBuy); fixes++; console.log('Fixed test_traits_can_buy'); }
else console.log('WARN: test_traits_can_buy not found');
if (text.includes(oldSell)) { text = text.replace(oldSell, newSell); fixes++; console.log('Fixed test_traits_can_sell'); }
else console.log('WARN: test_traits_can_sell not found');

fs.writeFileSync(f, text);
console.log('Fixes: ' + fixes);
