import { useState, useCallback, useRef } from 'react';

export function useDebounce(fn, delay = 600) {
  const timer = useRef(null);

  const debounced = useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);

  const flush = useCallback((...args) => {
    clearTimeout(timer.current);
    fn(...args);
  }, [fn]);

  const cancel = useCallback(() => {
    clearTimeout(timer.current);
  }, []);

  return { debounced, flush, cancel };
}
