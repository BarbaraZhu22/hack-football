export const initialSceneState = {
  camera: {
    position: [0, 18, 28],
    lookAt: [0, 0, 0],
  },
  players: [
    { id: "9", team: "home", position: [-2, 0.45, 1] },
    { id: "10", team: "home", position: [1, 0.45, -1] },
    { id: "7", team: "away", position: [3, 0.45, 2] },
  ],
  ball: { position: [0, 0.2, 0] },
  arrows: [],
  highlight: null,
};

export function applySceneAction(state, action) {
  if (!action?.type) return state;

  switch (action.type) {
    case "camera.set":
      return {
        ...state,
        camera: {
          position: action.position ?? state.camera.position,
          lookAt: action.lookAt ?? state.camera.lookAt,
        },
      };
    case "players.set":
      return {
        ...state,
        players: Array.isArray(action.players) ? action.players : state.players,
      };
    case "ball.set":
      return {
        ...state,
        ball: {
          position: action.position ?? state.ball.position,
        },
      };
    case "arrow.add": {
      const next = state.arrows.filter((arrow) => arrow.id !== action.id);
      next.push({
        id: action.id ?? `arrow-${next.length + 1}`,
        from: action.from ?? [0, 0, 0],
        to: action.to ?? [0, 0, 0],
      });
      return { ...state, arrows: next };
    }
    case "arrow.clear":
      return { ...state, arrows: [] };
    case "highlight":
      return {
        ...state,
        highlight: {
          target: action.target ?? "player",
          id: action.id ?? null,
        },
      };
    case "reset":
      return { ...initialSceneState };
    default:
      return state;
  }
}

export function applySceneActions(state, actions) {
  if (!Array.isArray(actions)) return state;
  return actions.reduce((next, action) => applySceneAction(next, action), state);
}
