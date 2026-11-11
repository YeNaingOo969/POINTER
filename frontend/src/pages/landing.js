// Entry script for index.html: the cinematic POINTER landing (M4).
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/components/brand.css';
import '../styles/pages/landing.css';
import { initI18n } from '../i18n/i18n.js';
import { timeInYangon } from '../lib/format.js';
import { playIntro } from '../landing/intro.js';
import { heroEntrance, heroParallax, scrollScenes, refreshScenes } from '../landing/scenes.js';
import { embers } from '../landing/embers.js';
import { magnetic } from '../landing/magnetic.js';

initI18n();

// Live Yangon clock in the hero corner.
const clock = document.querySelector('.hero__clock');
const tick = () => { clock.textContent = timeInYangon(Date.now()); };
tick();
setInterval(tick, 20_000);

scrollScenes();
heroParallax();
magnetic();
const stopEmbers = embers(document.querySelector('.hero__embers'));

playIntro(document.querySelector('.intro')).then(heroEntrance);

// Pinned sections measure the page; measure again once fonts and images have settled.
document.fonts?.ready.then(refreshScenes);
addEventListener('load', refreshScenes, { once: true });
addEventListener('pagehide', stopEmbers);
