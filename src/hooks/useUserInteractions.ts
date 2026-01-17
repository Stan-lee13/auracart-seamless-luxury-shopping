import { useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Local storage key for anonymous user interactions
const INTERACTIONS_KEY = 'auracart_interactions';

interface InteractionData {
  productViews: Record<string, number>;
  categoryInteractions: Record<string, number>;
  searchQueries: string[];
  cartAdditions: string[];
  lastUpdated: number;
}

const getStoredInteractions = (): InteractionData => {
  try {
    const stored = localStorage.getItem(INTERACTIONS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return {
    productViews: {},
    categoryInteractions: {},
    searchQueries: [],
    cartAdditions: [],
    lastUpdated: Date.now(),
  };
};

const saveInteractions = (data: InteractionData) => {
  try {
    localStorage.setItem(INTERACTIONS_KEY, JSON.stringify({
      ...data,
      lastUpdated: Date.now(),
    }));
  } catch {
    // ignore
  }
};

export function useUserInteractions() {
  const { user } = useAuth();

  const trackProductView = useCallback((productId: string, categoryId?: string) => {
    const data = getStoredInteractions();
    data.productViews[productId] = (data.productViews[productId] || 0) + 1;
    if (categoryId) {
      data.categoryInteractions[categoryId] = (data.categoryInteractions[categoryId] || 0) + 1;
    }
    saveInteractions(data);
  }, []);

  const trackSearch = useCallback((query: string) => {
    if (!query.trim()) return;
    const data = getStoredInteractions();
    // Keep only last 20 searches
    data.searchQueries = [query, ...data.searchQueries.filter(q => q !== query)].slice(0, 20);
    saveInteractions(data);
  }, []);

  const trackCartAddition = useCallback((productId: string, categoryId?: string) => {
    const data = getStoredInteractions();
    if (!data.cartAdditions.includes(productId)) {
      data.cartAdditions = [productId, ...data.cartAdditions].slice(0, 50);
    }
    if (categoryId) {
      data.categoryInteractions[categoryId] = (data.categoryInteractions[categoryId] || 0) + 2; // Weight cart more
    }
    saveInteractions(data);
  }, []);

  const trackCategoryInteraction = useCallback((categoryId: string) => {
    const data = getStoredInteractions();
    data.categoryInteractions[categoryId] = (data.categoryInteractions[categoryId] || 0) + 1;
    saveInteractions(data);
  }, []);

  const getTopCategories = useCallback((limit: number = 3): string[] => {
    const data = getStoredInteractions();
    return Object.entries(data.categoryInteractions)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => id);
  }, []);

  const getRecentlyViewed = useCallback((limit: number = 10): string[] => {
    const data = getStoredInteractions();
    return Object.entries(data.productViews)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([id]) => id);
  }, []);

  const getRecentSearches = useCallback((limit: number = 5): string[] => {
    const data = getStoredInteractions();
    return data.searchQueries.slice(0, limit);
  }, []);

  return {
    trackProductView,
    trackSearch,
    trackCartAddition,
    trackCategoryInteraction,
    getTopCategories,
    getRecentlyViewed,
    getRecentSearches,
  };
}

// Hook to get personalized product recommendations
export function useRecommendations() {
  const { getTopCategories, getRecentlyViewed } = useUserInteractions();
  
  const getRecommendationContext = useCallback(() => {
    return {
      topCategories: getTopCategories(3),
      recentlyViewed: getRecentlyViewed(10),
    };
  }, [getTopCategories, getRecentlyViewed]);

  return { getRecommendationContext };
}
