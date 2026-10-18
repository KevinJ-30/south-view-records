import { useEffect } from "react";

/** Sets the browser tab title for the current page. */
export function usePageTitle(title: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · South-View Burial Records` : "South-View Burial Records Index";
  }, [title]);
}
