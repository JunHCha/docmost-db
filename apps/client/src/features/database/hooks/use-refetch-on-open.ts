import { useEffect, useRef } from "react";

// Refetch a query the moment a dropdown/menu/modal is shown, so it never
// serves a stale cached list.
//
// The app disables refetchOnMount + refetchOnWindowFocus and uses a 5-min
// staleTime (main.tsx), so a persistently-mounted picker keeps showing whatever
// it cached on a previous open until that window expires — e.g. a database
// renamed elsewhere still shows its old name in the relation/embed pickers.
// Refetching on open makes the list idempotent regardless of which path changed
// the data.
//
// Fires only on the closed→open transition (not on every re-render while open),
// so an open picker isn't hammered by unrelated parent re-renders. `refetch`
// from react-query has a stable identity, so it is safe in the dependency list.
export function useRefetchOnOpen(opened: boolean, refetch: () => void) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (opened && !wasOpen.current) refetch();
    wasOpen.current = opened;
  }, [opened, refetch]);
}
