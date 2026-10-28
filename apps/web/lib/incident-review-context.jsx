"use client";

import { createContext, useCallback, useContext, useState } from "react";

const IncidentReviewContext = createContext({
  review: null,
  setReview: () => {},
  adjudicatorResults: {},
  setAdjudicatorResult: () => {},
  clearAdjudicatorResult: () => {},
});

export function IncidentReviewProvider({ children }) {
  const [review, setReview] = useState(null);
  const [adjudicatorResults, setAdjudicatorResults] = useState({});

  const setAdjudicatorResult = useCallback((result) => {
    if (!result?.incidentId) return;
    setAdjudicatorResults((current) => ({
      ...current,
      [result.incidentId]: result,
    }));
  }, []);

  const clearAdjudicatorResult = useCallback((incidentId) => {
    if (!incidentId) return;
    setAdjudicatorResults((current) => {
      if (!current[incidentId]) return current;
      const next = { ...current };
      delete next[incidentId];
      return next;
    });
  }, []);

  return (
    <IncidentReviewContext.Provider value={{ review, setReview, adjudicatorResults, setAdjudicatorResult, clearAdjudicatorResult }}>
      {children}
    </IncidentReviewContext.Provider>
  );
}

export function useIncidentReview() {
  return useContext(IncidentReviewContext);
}
