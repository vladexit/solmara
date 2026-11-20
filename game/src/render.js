// HUD: DOM text updates (cash, health, wanted stars, mission, radio, feed) and the
// 2D canvas minimap drawn top-down from the world state. Text is only written
// when it changes, so a frame allocates nothing.
import { CITY_HALF, GARAGE_ITEMS, GARAGE_POS, MISSIONS, RACE_START_PAD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WON = 'won';

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
    // Race start pad on Neon Row (only when no race is running) and Mara's
    // garage — both worth knowing at a glance.
    if (state.race.phase === 'idle') {
      minimap.fillStyle = '#ff5a3c';
      minimap.fillRect(toX(RACE_START_PAD.x) - 4, toZ(RACE_START_PAD.z) - 4, 8, 8);
    }
    minimap.fillStyle = '#ff2ea6';
    minimap.beginPath();
    minimap.arc(toX(GARAGE_POS.x), toZ(GARAGE_POS.z), 3.5, 0, Math.PI * 2);
    minimap.fill();
    // Taxi marker: cyan while the fare waits, green once they are riding.
    if (state.taxi.fare) {
      const t = state.taxi.active
        ? { x: state.taxi.fare.dx, z: state.taxi.fare.dz }
        : { x: state.taxi.fare.ped.x, z: state.taxi.fare.ped.z };
      minimap.fillStyle = state.taxi.active ? '#7dff5a' : '#2dd4ff';
      minimap.beginPath();
      minimap.arc(toX(t.x), toZ(t.z), 4, 0, Math.PI * 2);
      minimap.fill();
    }
    // Nearest hidden package: a small amber dot, so the hunt is followable.
    if (state.packages) {
      let nearestPkg = null;
      let nearestD = Infinity;
      for (const spot of state.packages.spots) {
        if (spot.taken) continue;
        const d = (spot.x - state.player.x) ** 2 + (spot.z - state.player.z) ** 2;
        if (d < nearestD) {
          nearestD = d;
          nearestPkg = spot;
        }
      }
      if (nearestPkg) {
        minimap.fillStyle = '#ffb020';
        minimap.beginPath();
        minimap.arc(toX(nearestPkg.x), toZ(nearestPkg.z), 2.5, 0, Math.PI * 2);
        minimap.fill();
      }
    }
    // Mission target, pulsing.
    if (target && !state.won) {
      const r = 4 + Math.sin(state.time * 4) * 1.5;
      minimap.fillStyle = '#ffd24d';
      minimap.beginPath();
      minimap.arc(toX(target.x), toZ(target.z), r, 0, Math.PI * 2);
      minimap.fill();
    }
    // Traffic, police and race rivals (rivals run orange).
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      minimap.fillStyle = car.kind === 'police' ? '#3a6fd8' : car.kind === 'racer' ? '#ff5a3c' : '#9aa2b2';
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
    setText(elements.objective, info.objective || '');
    setText(elements.radio, `${info.stationName}${info.muted ? ' (muted)' : ''}`);
    const speed = info.speedKmh;
    setText(elements.speed, info.inCar ? `${speed} km/h` : speed > 0.5 ? 'on foot' : '');
    setText(elements.prompt, info.prompt);
    // Round-3 side systems: weather clock, race position, taxi status.
    setText(elements.weatherLine, info.weatherLine || '');
    setText(elements.raceLine, info.raceLine || '');
    setText(elements.taxiLine, info.taxiLine || '');
    setText(elements.challengeLine, info.challengeLine || '');
    setText(elements.achievementLine, info.achievementLine || '');
    setText(elements.packageLine, info.packageLine || '');
    updateGarage(state, info);
    // Feed: the latest three posts.
    const feedHtml = state.feed.slice(0, 3).map((post) => `<div class="post"><b>${post.who}</b><span>${post.text}</span></div>`).join('');
    if (seen.get(elements.feed) !== feedHtml) {
      seen.set(elements.feed, feedHtml);
      elements.feed.innerHTML = feedHtml;
    }
    drawMinimap(state, info.target);
  }

  // Mara's garage shop overlay: the item list with prices and OWNED tags.
  // Rebuilt only when its text changes, like the feed.
  function updateGarage(state, info) {
    const overlay = elements.garageOverlay;
    if (!overlay) return;
    const g = info.garage;
    if (!g || !g.open) {
      overlay.classList.add('hidden');
      return;
    }
    overlay.classList.remove('hidden');
    const rows = GARAGE_ITEMS.map((item, i) => {
      const owned = item.kind === 'paint' ? g.paint === item.id
        : item.kind === 'engine' ? g.engine >= item.level
        : item.kind === 'armor' ? g.armor >= item.level
        : item.kind === 'neon' ? g.neon : false;
      // Nitro is a consumable: the tag shows the charges in the tank.
      const tag = item.kind === 'nitro' && g.nitro > 0 ? `x${g.nitro} · $${item.price}`
        : owned ? 'OWNED' : `$${item.price}`;
      const sel = i === g.selected ? ' class="sel"' : '';
      return `<div${sel}>${item.name} — ${item.desc} <b>${tag}</b></div>`;
    }).join('');
    const html = `<h2>MARA'S GARAGE</h2><div class="cash">Cash $${state.cash}</div>${rows}<div class="keys">W/S pick · Enter buy · G close</div>`;
    if (seen.get(overlay) !== html) {
      seen.set(overlay, html);
      overlay.innerHTML = html;
    }
  }

  function showOverlay(name) {
    for (const key of ['title', 'paused', 'busted', 'won']) {
      elements[`${key}Overlay`].classList.toggle('hidden', key !== name);
    }
  }

  // Fill the win screen: cash, the 7 chapters, cars stolen, punches, rams
  // and the clock, so the victory reads as a scorecard, not a flag flip.
  function showWin(state) {
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    setText(elements.winStats,
      `$${state.cash} banked · ${state.stats.missionsDone}/7 chapters · ${state.stats.stolen} cars stolen · ${state.stats.punches} punches · ${state.stats.rams} cars rammed · ${mins}:${String(secs).padStart(2, '0')} in the city${state.token.taken ? ' · Golden Token found' : ''}${state.packages.found > 0 ? ` · ${state.packages.found}/50 packages` : ''}`);
  }

  // Fill the pause menu with where the run stands.
  function showPause(statsText) {
    setText(elements.pausedStats, statsText);
  }

  return { update, showOverlay, showWin, showPause };
}
