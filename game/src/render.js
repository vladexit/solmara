// HUD: DOM text updates (cash, health, wanted stars, mission, radio, feed) and the
// 2D canvas minimap drawn top-down from the world state. Text is only written
// when it changes, so a frame allocates nothing.
import { CITY_HALF, MISSIONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';

export function createHud(elements) {
  const minimap = elements.minimap.getContext('2d');
  const seen = new Map();

  function setText(element, value) {
    if (seen.get(element) !== value) {
      seen.set(element, value);
      element.textContent = value;
    }
  }
  function setWidth(element, value) {
    if (seen.get(element) !== value) {
      seen.set(element, value);
      element.style.width = value;
    }
  }

  function drawMinimap(state, target) {
    const size = elements.minimap.width;
    const scale = size / (CITY_HALF * 2 + 40);
    const toX = (x) => size / 2 + x * scale;
    const toZ = (z) => size / 2 + z * scale;
    minimap.clearRect(0, 0, size, size);
    minimap.fillStyle = 'rgba(10, 12, 20, 0.85)';
    minimap.fillRect(0, 0, size, size);
    // Roads.
    minimap.strokeStyle = '#4a5160';
    minimap.lineWidth = 5;
    for (const c of [-180, -120, -60, 0, 60, 120, 180]) {
      minimap.beginPath();
      minimap.moveTo(toX(-CITY_HALF), toZ(c));
      minimap.lineTo(toX(CITY_HALF), toZ(c));
      minimap.stroke();
      minimap.beginPath();
      minimap.moveTo(toX(c), toZ(-CITY_HALF));
      minimap.lineTo(toX(c), toZ(CITY_HALF));
      minimap.stroke();
    }
    // Golden Token.
    if (!state.token.taken) {
      minimap.fillStyle = '#ffd24d';
      minimap.beginPath();
      minimap.arc(toX(state.token.x), toZ(state.token.z), 3.5, 0, Math.PI * 2);
      minimap.fill();
    }
    // Mission target, pulsing.
    if (target && !state.won) {
      const r = 4 + Math.sin(state.time * 4) * 1.5;
      minimap.fillStyle = '#ffd24d';
      minimap.beginPath();
      minimap.arc(toX(target.x), toZ(target.z), r, 0, Math.PI * 2);
      minimap.fill();
    }
    // Traffic and police.
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      minimap.fillStyle = car.kind === 'police' ? '#3a6fd8' : '#9aa2b2';
      minimap.beginPath();
      minimap.arc(toX(car.x), toZ(car.z), car.kind === 'police' ? 3 : 2, 0, Math.PI * 2);
      minimap.fill();
    }
    // Player arrow, rotated by heading.
    const p = state.player;
    minimap.save();
    minimap.translate(toX(p.x), toZ(p.z));
    minimap.rotate(Math.PI - p.heading);
    minimap.fillStyle = '#ffffff';
    minimap.beginPath();
    minimap.moveTo(0, -6);
    minimap.lineTo(4, 5);
    minimap.lineTo(-4, 5);
    minimap.closePath();
    minimap.fill();
    minimap.restore();
  }

  function update(state, info) {
    setText(elements.cash, `$${state.cash}`);
    setWidth(elements.healthBar, `${Math.max(0, Math.round(state.health))}%`);
    elements.healthBar.className = state.health < 30 ? 'health low' : 'health';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    setText(elements.wanted, stars);
    setText(elements.wantedLabel, state.wanted === 0 ? 'CLEAN' : `WANTED ${state.wanted}`);
    const mission = MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)];
    setText(elements.missionTitle, state.won ? 'SOLMARA IS YOURS' : mission.title);
    setText(elements.missionBrief, state.won ? 'The Big Score is done. Free roam — the city is yours.' : mission.brief);
    setText(elements.hint, state.hint);
    setText(elements.radio, `${info.stationName}${info.muted ? ' (muted)' : ''}`);
    const speed = info.speedKmh;
    setText(elements.speed, info.inCar ? `${speed} km/h` : speed > 0.5 ? 'on foot' : '');
    setText(elements.prompt, info.prompt);
    // Feed: the latest three posts.
    const feedHtml = state.feed.slice(0, 3).map((post) => `<div class="post"><b>${post.who}</b><span>${post.text}</span></div>`).join('');
    if (seen.get(elements.feed) !== feedHtml) {
      seen.set(elements.feed, feedHtml);
      elements.feed.innerHTML = feedHtml;
    }
    drawMinimap(state, info.target);
  }

  function showOverlay(name) {
    for (const key of ['title', 'paused', 'busted']) {
      elements[`${key}Overlay`].classList.toggle('hidden', key !== name);
    }
  }

  return { update, showOverlay };
}
