import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    // Run once on mount if needed, though initial state is setup.
    // setIsMobile(window.innerWidth < MOBILE_BREAKPOINT) // Removed to prevent synchronous setState
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
