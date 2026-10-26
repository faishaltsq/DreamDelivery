// Dream Delivery vertical slice game state (pure logic, no DOM).
// Scenario: Dream Post Office → Write Letter → Choose Courier → Route → Journey → Encounter → Story Postcard

export function initialState() {
  return {
    screen: 'post-office',        // post-office | write | choose | route-map | journey | encounter | postcard | album
    courierId: null,              // momo | lune | pip
    recipient: '',
    message: '',
    stamps: [],
    letters: [],                  // {recipient, message, routeId, courierId, at}
    journey: null,                // {routeId, progress}
    encounter: null,
    sealPlaced: false,
  };
}

export const COURIERS = Object.freeze({
  momo: { id: 'momo', name: 'Momo', title: 'The Curious Cat', accent: '#E5AA65' },
  lune: { id: 'lune', name: 'Lune', title: 'The Moon Rabbit', accent: '#EAA9D3' },
  pip:  { id: 'pip',  name: 'Pip',  title: 'The Sleepy Bird', accent: '#7DB8DF' },
});

// Journey length scales with route id order in the map (cloud 8s, forest 10s, moon 12s, stars 14s) — variety, not balance.
export const ROUTES = Object.freeze({
  cloudpath: {
    id: 'cloudpath', label: 'Cloudpath', duration: 8,
    scene: '/assets/environments/cloudpath/scene-native.png',
    tile: '/assets/events/location-cloudpath.png',
    stamp: 'crescent', encounter: 'cloud-visitor',
    hint: 'A bridge of sleeping clouds. Bring the letter before dawn giggles.',
  },
  'forest-of-whispers': {
    id: 'forest-of-whispers', label: 'Forest of Whispers', duration: 10,
    scene: '/assets/environments/forest-of-whispers/scene-native.png',
    tile: '/assets/events/location-forest-of-whispers.png',
    stamp: 'dream-forest', encounter: 'firefly-choir',
    hint: 'The trees repeat your letter until it sounds true.',
  },
  moonfield: {
    id: 'moonfield', label: 'Moonfield', duration: 12,
    scene: '/assets/environments/moonfield/scene-native.png',
    tile: '/assets/events/location-moonfield.png',
    stamp: 'moonrise', encounter: 'moonlight-encounter',
    hint: 'Deliver to the sleeping farm beneath the moon.',
  },
  starport: {
    id: 'starport', label: 'Starport', duration: 14,
    scene: '/assets/environments/starport/scene-native.png',
    tile: '/assets/events/location-starport.png',
    stamp: 'starry-night', encounter: 'ferry-of-stars',
    hint: 'Where paper boats launch toward the morning star.',
  },
});

// One story beat per route; effect art from assets/effects.
export const ENCOUNTERS = Object.freeze({
  'cloud-visitor': {
    id: 'cloud-visitor',
    title: 'A Visitor on the Cloudpath',
    text: 'A puff Of wind walks beside you, wearing the shape of someone who once napped on this very cloud. It reads the address, laughs softly, and points the way on.',
    effectAsset: '/assets/effects/cloud-fluff.png',
  },
  'firefly-choir': {
    id: 'firefly-choir',
    title: 'The Firefly Choir',
    text: 'Fireflies settle on the envelope and hum the letter to sleep. The forest agrees to deliver its echo ahead of you.',
    effectAsset: '/assets/effects/sparkles.png',
  },
  'moonlight-encounter': {
    id: 'moonlight-encounter',
    title: 'Moonlight Encounter',
    text: 'A soft glow parts the tall moon-grass. The Night Hare listens to your letter, then points the way to the sleeping farm below.',
    effectAsset: '/assets/effects/moonburst.png',
  },
  'ferry-of-stars': {
    id: 'ferry-of-stars',
    title: 'The Ferry of Stars',
    text: 'At the dock of small lights, the ferry keeper stamps the envelope with a flick of starlight. It always lands a little crooked, and always on purpose.',
    effectAsset: '/assets/effects/star-glow.png',
  },
});

export const STAMPS = Object.freeze({
  'crescent': '/assets/stamps/crescent.png',
  'dream-forest': '/assets/stamps/dream-forest.png',
  'moonrise': '/assets/stamps/moonrise.png',
  'starry-night': '/assets/stamps/starry-night.png',
});

// In-route reward stamps beyond the four route stamps (album shows all nine pack stamps).
export const BONUS_STAMPS = Object.freeze({
  'castle': '/assets/stamps/castle.png',
  'windmill': '/assets/stamps/windmill.png',
  'portal-forest': '/assets/stamps/portal-forest.png',
  'twilight-port': '/assets/stamps/twilight-port.png',
  'floating-city': '/assets/stamps/floating-city.png',
});

export function allStampIds() {
  return [...Object.keys(STAMPS), ...Object.keys(BONUS_STAMPS)];
}

// Pure transition: returns next state; invalid moves return same state.
export function dispatch(state, action) {
  switch (action.type) {
    case 'START_WRITING':
      if (state.screen !== 'post-office' && state.screen !== 'album') return state;
      return { ...state, screen: 'write' };

    case 'OPEN_ALBUM':
      if (state.screen !== 'post-office') return state;
      return { ...state, screen: 'album' };

    case 'CHOOSE_COURIER':
      if (state.screen !== 'choose' || !COURIERS[action.courierId]) return state;
      return { ...state, courierId: action.courierId };

    case 'SEAL_LETTER':
      if (state.screen !== 'write' || !state.message.trim() || !state.recipient.trim()) return state;
      return { ...state, sealPlaced: true };

    case 'OPEN_ROUTE_MAP':
      if (state.screen !== 'choose') return state;
      return { ...state, screen: 'route-map' };

    case 'BACK':
      if (state.screen === 'album') return { ...state, screen: 'post-office' };
      if (state.screen === 'choose') return { ...state, screen: 'write', sealPlaced: false };
      if (state.screen === 'route-map') return { ...state, screen: 'choose' };
      return state;

    case 'BEGIN_JOURNEY':
      if (state.screen !== 'route-map' || !state.courierId || !state.sealPlaced) return state;
      if (!ROUTES[action.routeId]) return state;
      return { ...state, screen: 'journey', _delivered: false,
               journey: { routeId: action.routeId, progress: 0 } };

    case 'ADVANCE_JOURNEY':
      if (state.screen !== 'journey' || !state.journey) return state;
      {
        const route = ROUTES[state.journey.routeId];
        const j = { ...state.journey, progress: Math.min(1, state.journey.progress + action.dt / route.duration) };
        if (j.progress < 1) return { ...state, journey: j };
        return { ...state, screen: 'encounter',
                 encounter: ENCOUNTERS[route.encounter],
                 journey: { ...state.journey, progress: 1 } };
      }

    case 'CLAIM_STAMP':
      if (state.screen !== 'encounter' || !state.encounter) return state;
      {
        const stampId = ROUTES[state.journey.routeId].stamp;
        if (state.stamps.includes(stampId)) return state;
        return { ...state, stamps: [...state.stamps, stampId] };
      }

    case 'FINISH_DELIVERY':
      if (state.screen !== 'encounter') return state;
      // A completed delivery cannot append a second history entry.
      if (state._delivered) return state;
      return { ...state,
        screen: 'postcard',
        _delivered: true,
        letters: [...state.letters, {
          recipient: state.recipient, message: state.message,
          routeId: state.journey.routeId, courierId: state.courierId, at: Date.now(),
        }] };

    case 'RESET':
      return { ...initialState(), stamps: state.stamps, letters: state.letters };

    default:
      return state;
  }
}
