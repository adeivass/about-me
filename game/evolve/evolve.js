const STORAGE_KEY = 'EVOLVE_LOCAL_SIM_V4';
const LEGACY_STORAGE_KEYS = ['EVOLVE_LOCAL_SIM_V3', 'EVOLVE_LOCAL_SIM_V2', 'EVOLVE_GAME_STATE_V1'];
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 480;
const MAX_ORGANISMS = 100;
const MAX_FOOD = 25;
const MAX_TRAIT = 10;
const INITIAL_ORGANISMS = 18;
const INITIAL_FOOD = 20;
const INITIAL_PREDATORS = 3;

const DEFAULT_STATE = {
  traits: { speed: 1, intel: 1, def: 1, repr: 1 },
  pendingTraits: { speed: 0, intel: 0, def: 0, repr: 0 },
  pointsAvailable: 3,
  adaptationCycle: 1,
  elapsedSeconds: 0,
  highestGeneration: 1,
  foodRegrowthTicks: 0,
};

let state = structuredClone(DEFAULT_STATE);
let canvas;
let ctx;
let organisms = [];
let foodSources = [];
let predators = [];
let paused = false;
let activeTool = 'inspect';
let lastFrameTime = 0;

function randomPosition(padding = 12) {
  return {
    x: padding + Math.random() * (WORLD_WIDTH - padding * 2),
    y: padding + Math.random() * (WORLD_HEIGHT - padding * 2),
  };
}

function makeOrganism(x, y, generation = 1, energy = 70) {
  const angle = Math.random() * Math.PI * 2;
  return { x, y, vx: Math.cos(angle), vy: Math.sin(angle), energy, generation };
}

function makeFood(x, y) {
  return { x, y };
}

function makePredator(x, y) {
  const angle = Math.random() * Math.PI * 2;
  return { x, y, vx: Math.cos(angle), vy: Math.sin(angle) };
}

function createFreshWorld() {
  organisms = Array.from({ length: INITIAL_ORGANISMS }, () => {
    const point = randomPosition();
    return makeOrganism(point.x, point.y, 1, 60 + Math.random() * 35);
  });
  foodSources = Array.from({ length: INITIAL_FOOD }, () => {
    const point = randomPosition();
    return makeFood(point.x, point.y);
  });
  predators = Array.from({ length: INITIAL_PREDATORS }, () => {
    const point = randomPosition();
    return makePredator(point.x, point.y);
  });
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved?.version === 2 && saved.state && Array.isArray(saved.organisms)) {
      state = {
        ...structuredClone(DEFAULT_STATE),
        ...saved.state,
        traits: { ...DEFAULT_STATE.traits, ...saved.state.traits },
        pendingTraits: { ...DEFAULT_STATE.pendingTraits, ...saved.state.pendingTraits },
      };
      organisms = saved.organisms.slice(0, MAX_ORGANISMS);
      foodSources = Array.isArray(saved.foodSources) ? saved.foodSources.slice(0, MAX_FOOD) : [];
      predators = Array.isArray(saved.predators) ? saved.predators : [];
      return;
    }
  } catch (error) {
    console.warn('Saved EVOLVE state could not be loaded; starting a fresh world.', error);
  }
  createFreshWorld();
}

function saveState() {
  const save = {
    version: 2,
    state,
    organisms,
    foodSources,
    predators,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch (error) {
    logEvent('Could not save this world in browser storage.');
    console.error('Could not save EVOLVE state.', error);
  }
}

function logEvent(message) {
  const feed = document.getElementById('logFeed');
  const entry = document.createElement('div');
  entry.className = 'log-entry event';
  const time = new Date().toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  entry.textContent = `[${time}] ${message}`;
  feed.prepend(entry);
  while (feed.children.length > 30) feed.lastElementChild.remove();
}

function updateUI() {
  document.getElementById('popVal').textContent = organisms.length.toLocaleString();
  document.getElementById('foodVal').textContent = foodSources.length.toLocaleString();
  document.getElementById('predatorVal').textContent = predators.length.toLocaleString();
  document.getElementById('genVal').textContent = state.highestGeneration.toLocaleString();
  const averageEnergy = organisms.length
    ? Math.round(organisms.reduce((total, organism) => total + organism.energy, 0) / organisms.length)
    : null;
  document.getElementById('energyVal').textContent = averageEnergy === null ? '—' : `${averageEnergy}%`;

  const totalSeconds = state.elapsedSeconds;
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  document.getElementById('worldTimeDisplay').textContent = `SIM TIME: ${hours}:${minutes}:${seconds}`;
  document.getElementById('ptsVal').textContent = state.pointsAvailable;

  for (const trait of Object.keys(state.traits)) {
    const displayedValue = state.traits[trait] + state.pendingTraits[trait];
    document.getElementById(`${trait}Val`).textContent = displayedValue;
    document.querySelector(`.trait-minus[data-trait="${trait}"]`).disabled = state.pendingTraits[trait] === 0;
    document.querySelector(`.trait-plus[data-trait="${trait}"]`).disabled =
      state.pointsAvailable === 0 || displayedValue >= MAX_TRAIT;
  }

  const hasPendingChanges = Object.values(state.pendingTraits).some(value => value > 0);
  document.getElementById('mutateBtn').disabled = !hasPendingChanges;
  const pauseButton = document.getElementById('pauseBtn');
  pauseButton.textContent = paused ? 'Resume Simulation' : 'Pause Simulation';
  pauseButton.title = paused
    ? 'Resume movement, energy use, feeding, and reproduction.'
    : 'Pause movement, energy use, feeding, and reproduction. The world can still be edited.';
}

function nearestFood(x, y) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const food of foodSources) {
    const distance = Math.hypot(food.x - x, food.y - y);
    if (distance < nearestDistance) {
      nearest = food;
      nearestDistance = distance;
    }
  }
  return nearest ? { food: nearest, distance: nearestDistance } : null;
}

function nearestOrganism(x, y) {
  let nearest = null;
  let nearestDistance = Infinity;
  for (const organism of organisms) {
    const distance = Math.hypot(organism.x - x, organism.y - y);
    if (distance < nearestDistance) {
      nearest = organism;
      nearestDistance = distance;
    }
  }
  return nearest ? { organism: nearest, distance: nearestDistance } : null;
}

function moveEntities(deltaSeconds) {
  const speed = 16 + state.traits.speed * 8;
  for (const organism of organisms) {
    if (state.traits.intel > 0) {
      const target = nearestFood(organism.x, organism.y);
      if (target && target.distance < 300) {
        const dx = (target.food.x - organism.x) / target.distance;
        const dy = (target.food.y - organism.y) / target.distance;
        organism.vx += (dx - organism.vx) * Math.min(1, deltaSeconds * state.traits.intel * 0.7);
        organism.vy += (dy - organism.vy) * Math.min(1, deltaSeconds * state.traits.intel * 0.7);
      }
    }
    const vectorLength = Math.hypot(organism.vx, organism.vy) || 1;
    organism.vx /= vectorLength;
    organism.vy /= vectorLength;
    organism.x += organism.vx * speed * deltaSeconds;
    organism.y += organism.vy * speed * deltaSeconds;
    if (organism.x < 8 || organism.x > WORLD_WIDTH - 8) organism.vx *= -1;
    if (organism.y < 8 || organism.y > WORLD_HEIGHT - 8) organism.vy *= -1;
    organism.x = Math.max(8, Math.min(WORLD_WIDTH - 8, organism.x));
    organism.y = Math.max(8, Math.min(WORLD_HEIGHT - 8, organism.y));
  }

  for (const predator of predators) {
    const target = nearestOrganism(predator.x, predator.y);
    if (target && target.distance > 0) {
      const dx = (target.organism.x - predator.x) / target.distance;
      const dy = (target.organism.y - predator.y) / target.distance;
      predator.vx += (dx - predator.vx) * Math.min(1, deltaSeconds * 1.2);
      predator.vy += (dy - predator.vy) * Math.min(1, deltaSeconds * 1.2);
    }
    const vectorLength = Math.hypot(predator.vx, predator.vy) || 1;
    predator.vx /= vectorLength;
    predator.vy /= vectorLength;
    predator.x += predator.vx * 27 * deltaSeconds;
    predator.y += predator.vy * 27 * deltaSeconds;
    if (predator.x < 8 || predator.x > WORLD_WIDTH - 8) predator.vx *= -1;
    if (predator.y < 8 || predator.y > WORLD_HEIGHT - 8) predator.vy *= -1;
    predator.x = Math.max(8, Math.min(WORLD_WIDTH - 8, predator.x));
    predator.y = Math.max(8, Math.min(WORLD_HEIGHT - 8, predator.y));
  }
}

function simulationTick() {
  if (paused) return;
  state.elapsedSeconds += 1;
  let meals = 0;
  let births = 0;
  let deaths = 0;

  for (let index = organisms.length - 1; index >= 0; index--) {
    const organism = organisms[index];
    organism.energy = Math.max(0, organism.energy - 0.4);
    const meal = nearestFood(organism.x, organism.y);
    if (meal && meal.distance < 18) {
      foodSources.splice(foodSources.indexOf(meal.food), 1);
      organism.energy = Math.min(100, organism.energy + 38);
      meals++;
    }
    if (organism.energy <= 0) {
      organisms.splice(index, 1);
      deaths++;
      continue;
    }
    const reproductionChance = Math.min(0.8, 0.04 + state.traits.repr * 0.035);
    if (
      organism.energy >= 78 &&
      organisms.length < MAX_ORGANISMS &&
      Math.random() < reproductionChance
    ) {
      organism.energy -= 42;
      const child = makeOrganism(organism.x, organism.y, organism.generation + 1, 52);
      organisms.push(child);
      state.highestGeneration = Math.max(state.highestGeneration, child.generation);
      births++;
    }
  }

  for (let predatorIndex = 0; predatorIndex < predators.length; predatorIndex++) {
    const predator = predators[predatorIndex];
    const target = nearestOrganism(predator.x, predator.y);
    if (target && target.distance < 11) {
      const catchChance = Math.max(0.08, 0.4 - state.traits.def * 0.06);
      if (Math.random() < catchChance) {
        organisms.splice(organisms.indexOf(target.organism), 1);
        deaths++;
      }
    }
  }

  state.foodRegrowthTicks++;
  if (foodSources.length < MAX_FOOD && state.foodRegrowthTicks >= 3) {
    const point = randomPosition();
    foodSources.push(makeFood(point.x, point.y));
    state.foodRegrowthTicks = 0;
  }

  if (meals) logEvent(`${meals} organism${meals === 1 ? '' : 's'} found food.`);
  if (births) logEvent(`${births} new organism${births === 1 ? '' : 's'} reproduced.`);
  if (deaths) logEvent(`${deaths} organism${deaths === 1 ? '' : 's'} died or were caught.`);
  if (organisms.length === 0) logEvent('No organisms remain. Place an organism to restart the population.');
  updateUI();
}

function renderSimulation() {
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = 'rgba(14, 165, 233, 0.08)';
  ctx.beginPath();
  ctx.arc(WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5, 140, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#10b981';
  for (const food of foodSources) {
    ctx.beginPath();
    ctx.arc(food.x, food.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#ef4444';
  for (const predator of predators) {
    ctx.beginPath();
    ctx.arc(predator.x, predator.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 8;
  for (const organism of organisms) {
    ctx.beginPath();
    ctx.arc(organism.x, organism.y, 3 + state.traits.def * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function animationFrame(time) {
  const deltaSeconds = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.05) : 0;
  lastFrameTime = time;
  if (!paused) moveEntities(deltaSeconds);
  renderSimulation();
  requestAnimationFrame(animationFrame);
}

function modifyTrait(trait, delta) {
  const currentValue = state.traits[trait] + state.pendingTraits[trait];
  if (delta > 0 && state.pointsAvailable > 0 && currentValue < MAX_TRAIT) {
    state.pendingTraits[trait]++;
    state.pointsAvailable--;
  } else if (delta < 0 && state.pendingTraits[trait] > 0) {
    state.pendingTraits[trait]--;
    state.pointsAvailable++;
  }
  updateUI();
  saveState();
}

function commitAdaptation() {
  if (!Object.values(state.pendingTraits).some(value => value > 0)) return;
  for (const trait of Object.keys(state.traits)) {
    state.traits[trait] += state.pendingTraits[trait];
    state.pendingTraits[trait] = 0;
  }
  state.pointsAvailable = 3;
  state.adaptationCycle++;
  logEvent(`Adaptation cycle ${state.adaptationCycle} applied. Traits now affect the whole population.`);
  updateUI();
  saveState();
}

function selectWorldTool(tool) {
  activeTool = tool;
  document.querySelectorAll('.world-tool').forEach(button => {
    button.classList.toggle('active', button.dataset.tool === tool);
  });
  const hints = {
    inspect: 'Inspect mode: click an organism, food source, or predator for details.',
    food: 'Place food: click anywhere in the world to add one food source.',
    predator: 'Place predator: click anywhere in the world to add one predator.',
    organism: 'Place organism: click anywhere in the world to add one organism.',
  };
  document.getElementById('toolHint').textContent = hints[tool];
  canvas.style.cursor = tool === 'inspect' ? 'crosshair' : 'copy';
}

function handleWorldClick(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width) * WORLD_WIDTH;
  const y = ((event.clientY - bounds.top) / bounds.height) * WORLD_HEIGHT;

  if (activeTool === 'food') {
    if (foodSources.length >= MAX_FOOD) {
      document.getElementById('toolHint').textContent = `Food limit reached (${MAX_FOOD}). Organisms consume food and it regrows over time.`;
      return;
    }
    foodSources.push(makeFood(x, y));
    logEvent('Food placed in the world.');
    updateUI();
    saveState();
    return;
  }
  if (activeTool === 'predator') {
    predators.push(makePredator(x, y));
    logEvent('Predator placed in the world.');
    updateUI();
    saveState();
    return;
  }
  if (activeTool === 'organism') {
    if (organisms.length >= MAX_ORGANISMS) {
      document.getElementById('toolHint').textContent = `Population limit reached (${MAX_ORGANISMS}).`;
      return;
    }
    organisms.push(makeOrganism(x, y, 1, 75));
    logEvent('Organism placed in the world.');
    updateUI();
    saveState();
    return;
  }

  const organism = nearestOrganism(x, y);
  const food = nearestFood(x, y);
  const predator = predators
    .map(item => ({ item, distance: Math.hypot(item.x - x, item.y - y) }))
    .sort((a, b) => a.distance - b.distance)[0];
  const closest = [
    organism && { type: 'Organism', distance: organism.distance, item: organism.organism },
    food && { type: 'Food', distance: food.distance, item: food.food },
    predator && { type: 'Predator', distance: predator.distance, item: predator.item },
  ].filter(Boolean).sort((a, b) => a.distance - b.distance)[0];
  const hint = document.getElementById('toolHint');
  if (!closest || closest.distance > 24) {
    hint.textContent = 'Nothing nearby. Select a placement tool or click closer to an object.';
    return;
  }
  if (closest.type === 'Organism') {
    hint.textContent = `Organism · energy ${Math.round(closest.item.energy)}% · generation ${closest.item.generation}.`;
  } else {
    hint.textContent = `${closest.type} selected. Its position is ${Math.round(closest.item.x)}, ${Math.round(closest.item.y)}.`;
  }
}

function togglePause() {
  paused = !paused;
  logEvent(paused ? 'Simulation paused.' : 'Simulation resumed.');
  updateUI();
  saveState();
}

function resetGame() {
  const confirmed = window.confirm(
    'Reset EVOLVE? This permanently removes this game’s saved world and progress from this browser.'
  );
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  LEGACY_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
  window.location.reload();
}

function init() {
  canvas = document.getElementById('worldCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;

  loadState();
  document.querySelectorAll('.trait-plus').forEach(button => {
    button.addEventListener('click', () => modifyTrait(button.dataset.trait, 1));
  });
  document.querySelectorAll('.trait-minus').forEach(button => {
    button.addEventListener('click', () => modifyTrait(button.dataset.trait, -1));
  });
  document.querySelectorAll('.world-tool').forEach(button => {
    button.addEventListener('click', () => selectWorldTool(button.dataset.tool));
  });
  canvas.addEventListener('click', handleWorldClick);
  document.getElementById('mutateBtn').addEventListener('click', commitAdaptation);
  document.getElementById('pauseBtn').addEventListener('click', togglePause);
  document.getElementById('resetGameBtn').addEventListener('click', resetGame);

  logEvent(`Local simulation ready: ${organisms.length} organisms, ${foodSources.length} food sources, ${predators.length} predators.`);
  updateUI();
  requestAnimationFrame(animationFrame);
  window.setInterval(simulationTick, 1000);
  window.setInterval(saveState, 5000);
}

document.addEventListener('DOMContentLoaded', init);
