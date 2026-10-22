"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
} from "react";

import {
  applySceneActions,
  initialSceneState,
} from "@/lib/scene/commands";

const SceneContext = createContext(null);

function sceneReducer(state, action) {
  if (action.type === "run") {
    return applySceneActions(state, action.actions);
  }
  return state;
}

export function SceneProvider({ children }) {
  const [state, dispatch] = useReducer(sceneReducer, initialSceneState);

  const run = useCallback((actions) => {
    dispatch({ type: "run", actions });
  }, []);

  const value = useMemo(
    () => ({
      state,
      run,
    }),
    [state, run],
  );

  return (
    <SceneContext.Provider value={value}>{children}</SceneContext.Provider>
  );
}

export function useScene() {
  const value = useContext(SceneContext);
  if (!value) {
    throw new Error("useScene must be used within SceneProvider");
  }
  return value;
}
