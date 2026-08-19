import { useState, useEffect, useRef } from 'react';

export function useMinLoadTime(isLoading, minTime = 3000) {
  const [isMinLoading, setIsMinLoading] = useState(isLoading);
  const startTime = useRef(Date.now());

  useEffect(() => {
    if (isLoading) {
      setIsMinLoading(true);
      startTime.current = Date.now();
    } else {
      const elapsed = Date.now() - startTime.current;
      const remaining = minTime - elapsed;
      if (remaining > 0) {
        const t = setTimeout(() => setIsMinLoading(false), remaining);
        return () => clearTimeout(t);
      } else {
        setIsMinLoading(false);
      }
    }
  }, [isLoading, minTime]);

  return isLoading || isMinLoading;
}
