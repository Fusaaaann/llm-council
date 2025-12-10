/**
 * Unified Query State Management
 *
 * Centralizes the state of ongoing queries (message streams) separate from message data.
 * This separation of concerns allows loading states to work independently of data lifecycle.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

// Query state structure per conversation
// {
//   [conversationId]: {
//     currentQueryId: "uuid",
//     isActive: true,
//     stages: {
//       stage1: { status: "idle" | "loading" | "complete", startedAt: timestamp },
//       stage1_5: { status: "idle" | "loading" | "complete", startedAt: timestamp },
//       stage2: { status: "idle" | "loading" | "complete", startedAt: timestamp },
//       stage3: { status: "idle" | "loading" | "complete", startedAt: timestamp }
//     },
//     startedAt: timestamp,
//     completedAt: timestamp | null
//   }
// }

const QueryStateContext = createContext(null);

export function QueryStateProvider({ children }) {
  const [queryStates, setQueryStates] = useState({});

  /**
   * Start a new query for a conversation
   */
  const startQuery = useCallback((conversationId) => {
    const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    setQueryStates(prev => ({
      ...prev,
      [conversationId]: {
        currentQueryId: queryId,
        isActive: true,
        stages: {
          stage1: { status: 'loading', startedAt: Date.now() },  // Start with stage1 loading
          stage1_5: { status: 'idle', startedAt: null },
          stage2: { status: 'idle', startedAt: null },
          stage3: { status: 'idle', startedAt: null }
        },
        startedAt: Date.now(),
        completedAt: null
      }
    }));

    console.log('[QueryState] Started query:', queryId, 'for conversation:', conversationId);
    return queryId;
  }, []);

  /**
   * Update a specific stage's status
   */
  const updateStageStatus = useCallback((conversationId, stage, status) => {
    setQueryStates(prev => {
      const currentState = prev[conversationId];
      if (!currentState) {
        console.warn('[QueryState] No active query for conversation:', conversationId);
        return prev;
      }

      const updatedStage = {
        ...currentState.stages[stage],
        status,
        startedAt: status === 'loading' ? Date.now() : currentState.stages[stage].startedAt
      };

      console.log('[QueryState] Stage update:', { conversationId, stage, status });

      return {
        ...prev,
        [conversationId]: {
          ...currentState,
          stages: {
            ...currentState.stages,
            [stage]: updatedStage
          }
        }
      };
    });
  }, []);

  /**
   * Mark entire query as complete
   */
  const completeQuery = useCallback((conversationId) => {
    setQueryStates(prev => {
      const currentState = prev[conversationId];
      if (!currentState) {
        console.warn('[QueryState] No active query to complete for conversation:', conversationId);
        return prev;
      }

      console.log('[QueryState] Completed query:', currentState.currentQueryId);

      return {
        ...prev,
        [conversationId]: {
          ...currentState,
          isActive: false,
          completedAt: Date.now()
        }
      };
    });
  }, []);

  /**
   * Cancel an active query
   */
  const cancelQuery = useCallback((conversationId) => {
    setQueryStates(prev => {
      const currentState = prev[conversationId];
      if (!currentState) {
        return prev;
      }

      console.log('[QueryState] Cancelled query:', currentState.currentQueryId);

      // Mark as inactive and set all in-progress stages to idle
      return {
        ...prev,
        [conversationId]: {
          ...currentState,
          isActive: false,
          stages: Object.fromEntries(
            Object.entries(currentState.stages).map(([key, stage]) => [
              key,
              { ...stage, status: stage.status === 'loading' ? 'idle' : stage.status }
            ])
          ),
          completedAt: Date.now()
        }
      };
    });
  }, []);

  /**
   * Get query state for a specific conversation
   */
  const getQueryState = useCallback((conversationId) => {
    return queryStates[conversationId] || null;
  }, [queryStates]);

  /**
   * Check if a conversation has an active query
   */
  const isQueryActive = useCallback((conversationId) => {
    return queryStates[conversationId]?.isActive || false;
  }, [queryStates]);

  /**
   * Get status of a specific stage
   */
  const getStageStatus = useCallback((conversationId, stage) => {
    return queryStates[conversationId]?.stages[stage]?.status || 'idle';
  }, [queryStates]);

  const value = {
    queryStates,
    startQuery,
    updateStageStatus,
    completeQuery,
    cancelQuery,
    getQueryState,
    isQueryActive,
    getStageStatus
  };

  return (
    <QueryStateContext.Provider value={value}>
      {children}
    </QueryStateContext.Provider>
  );
}

/**
 * Hook to access query state
 */
export function useQueryState() {
  const context = useContext(QueryStateContext);
  if (!context) {
    throw new Error('useQueryState must be used within QueryStateProvider');
  }
  return context;
}
