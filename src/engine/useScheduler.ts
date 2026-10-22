import { useCallback, useEffect, useRef } from "react";

export function useScheduler() {
  const timeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  const frames = useRef(new Set<number>());
  const schedule = useCallback((callback: () => void, delay: number) => {
    const id = setTimeout(() => {
      timeouts.current.delete(id);
      callback();
    }, delay);
    timeouts.current.add(id);
    return id;
  }, []);
  const frame = useCallback((callback: (time: number) => void) => {
    const id = requestAnimationFrame((time) => {
      frames.current.delete(id);
      callback(time);
    });
    frames.current.add(id);
    return id;
  }, []);
  const clear = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    frames.current.forEach(cancelAnimationFrame);
    timeouts.current.clear();
    frames.current.clear();
  }, []);
  useEffect(() => clear, [clear]);
  return { schedule, frame, clear };
}
