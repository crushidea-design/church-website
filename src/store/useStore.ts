import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { QueryDocumentSnapshot } from 'firebase/firestore';

export type CollectionState = {
  data: any[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
  fetched: boolean;
};

export type CategoryCache = Record<string, CollectionState>;

const initialCollectionState: CollectionState = {
  data: [],
  lastDoc: null,
  hasMore: true,
  fetched: false,
};

interface AppState {
  sermons: CategoryCache;
  research: CategoryCache;
  journal: CollectionState;
  community: CollectionState;
  
  sermonCategories: any[];
  researchCategories: any[];
  
  todayWords: Record<string, any>;
  todayWordProgress: Record<string, any>;
  
  homeLatestPosts: any[];
  homeLatestPostsFetched: boolean;

  introFetched: boolean;
  setIntroFetched: (fetched: boolean) => void;

  setCollection: (key: 'journal' | 'community', data: any[], lastDoc: QueryDocumentSnapshot | null, hasMore: boolean) => void;
  appendCollection: (key: 'journal' | 'community', data: any[], lastDoc: QueryDocumentSnapshot | null, hasMore: boolean) => void;
  
  setCategoryCollection: (key: 'sermons' | 'research', categoryId: string, data: any[], lastDoc: QueryDocumentSnapshot | null, hasMore: boolean) => void;
  appendCategoryCollection: (key: 'sermons' | 'research', categoryId: string, data: any[], lastDoc: QueryDocumentSnapshot | null, hasMore: boolean) => void;
  
  setCategories: (key: 'sermonCategories' | 'researchCategories', cats: any[]) => void;
  
  setTodayWord: (dateStr: string, post: any) => void;
  setTodayWordProgress: (dateStr: string, progress: any) => void;
  
  setHomeLatestPosts: (posts: any[]) => void;
  
  resetCategory: (key: 'sermons' | 'research', categoryId: string) => void;
  invalidateCache: (key: 'journal' | 'community' | 'sermons' | 'research' | 'home' | 'today_word') => void;
  clearCache: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      sermons: {},
      research: {},
      journal: { ...initialCollectionState },
      community: { ...initialCollectionState },
      
      sermonCategories: [],
      researchCategories: [],
      
      todayWords: {},
      todayWordProgress: {},
      
      homeLatestPosts: [],
      homeLatestPostsFetched: false,
      
      introFetched: false,
      setIntroFetched: (fetched) => set({ introFetched: fetched }),

      setCollection: (key, data, lastDoc, hasMore) => set((state) => ({
        [key]: { data, lastDoc, hasMore, fetched: true }
      })),
      
      appendCollection: (key, data, lastDoc, hasMore) => set((state) => ({
        [key]: { 
          data: [...(state[key] as CollectionState).data, ...data], 
          lastDoc, 
          hasMore, 
          fetched: true 
        }
      })),

      setCategoryCollection: (key, categoryId, data, lastDoc, hasMore) => set((state) => ({
        [key]: {
          ...state[key],
          [categoryId]: { data, lastDoc, hasMore, fetched: true }
        }
      })),

      appendCategoryCollection: (key, categoryId, data, lastDoc, hasMore) => set((state) => {
        const existing = state[key][categoryId] || initialCollectionState;
        return {
          [key]: {
            ...state[key],
            [categoryId]: {
              data: [...existing.data, ...data],
              lastDoc,
              hasMore,
              fetched: true
            }
          }
        };
      }),
      
      setCategories: (key, cats) => set({ [key]: cats }),
      
      setTodayWord: (dateStr, post) => set((state) => ({
        todayWords: { ...state.todayWords, [dateStr]: { post, fetchedAt: Date.now() } }
      })),
      
      setTodayWordProgress: (dateStr, progress) => set((state) => ({
        todayWordProgress: { ...state.todayWordProgress, [dateStr]: progress }
      })),
      
      setHomeLatestPosts: (posts) => set({ homeLatestPosts: posts, homeLatestPostsFetched: true }),
      
      resetCategory: (key, categoryId) => set((state) => ({
        [key]: {
          ...state[key],
          [categoryId]: { ...initialCollectionState }
        }
      })),

      invalidateCache: (key) => set((state) => {
        if (key === 'journal' || key === 'community') {
          return { [key]: { ...initialCollectionState } };
        }
        if (key === 'sermons' || key === 'research') {
          return { [key]: {} };
        }
        if (key === 'home') {
          return { homeLatestPostsFetched: false };
        }
        if (key === 'today_word') {
          return { todayWords: {}, todayWordProgress: {} };
        }
        return {};
      }),

      clearCache: () => set({
        sermons: {},
        research: {},
        journal: { ...initialCollectionState },
        community: { ...initialCollectionState },
        sermonCategories: [],
        researchCategories: [],
        todayWords: {},
        todayWordProgress: {},
        homeLatestPosts: [],
        homeLatestPostsFetched: false,
        introFetched: false,
      }),
    }),
    {
      name: 'built-together-storage',
      partialize: (state) => ({
        sermonCategories: state.sermonCategories,
        researchCategories: state.researchCategories,
        todayWords: state.todayWords,
        todayWordProgress: state.todayWordProgress,
        homeLatestPosts: state.homeLatestPosts,
        homeLatestPostsFetched: state.homeLatestPostsFetched,
        introFetched: state.introFetched,
      }),
    }
  )
);
