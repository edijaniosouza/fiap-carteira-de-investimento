import { useEffect, useState } from "react";

// Hook names keep the `useXxx` form required by the Rules of Hooks.
export function useDebouncedValue<T>(value: T, delay_ms = 300): T {
  const [debounced_value, set_debounced_value] = useState(value);

  useEffect(() => {
    const timeout_id = setTimeout(() => set_debounced_value(value), delay_ms);
    return () => clearTimeout(timeout_id);
  }, [value, delay_ms]);

  return debounced_value;
}
