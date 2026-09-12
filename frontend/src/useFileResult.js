import { useCallback, useEffect, useRef, useState } from 'react';
import { releaseResult } from './api';

// Keep browser downloads alive until replaced or the page is closed.
export function useFileResult() {
  const [result, setResult] = useState(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => () => releaseResult(result), [result]);
  const update = useCallback(value => {
    if (active.current) setResult(value);
    else releaseResult(value);
  }, []);
  return [result, update];
}
