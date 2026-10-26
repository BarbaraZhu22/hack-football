"use client";

import { createContext, useContext, useState } from "react";

const IncidentReviewContext = createContext({
  review: null,
  setReview: () => {},
  adjudicatorResults: {},
  setAdjudicatorResult: () => {},
});

export function IncidentReviewProvider({ children }) {
  const [review, setReview] = useState(null);
  const [adjudicatorResults, setAdjudicatorResults] = useState({});

  function setAdjudicatorResult(result) {
    if (!result?.incidentId) return;
    setAdjudicatorResults((current) => ({
      ...current,
      [result.incidentId]: result,
    }));
  }

  return (
    <IncidentReviewContext.Provider value={{ review, setReview, adjudicatorResults, setAdjudicatorResult }}>
      {children}
    </IncidentReviewContext.Provider>
  );
}

export function useIncidentReview() {
  return useContext(IncidentReviewContext);
}
