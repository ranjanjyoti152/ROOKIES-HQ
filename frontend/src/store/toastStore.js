import { create } from 'zustand';

let timerMap = new Map();

const useToastStore = create((set) => ({
  toasts: [],
  pushToast: ({ type = 'info', title, message = '', duration = 3200 }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    set((state) => ({
      toasts: [...state.toasts, { id, type, title, message }],
    }));

    const timeoutId = setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
      timerMap.delete(id);
    }, duration);

    timerMap.set(id, timeoutId);
    return id;
  },
  dismissToast: (id) => {
    const existing = timerMap.get(id);
    if (existing) {
      clearTimeout(existing);
      timerMap.delete(id);
    }

    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export default useToastStore;
