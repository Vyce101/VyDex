// Defines the shared Stage 1 navigation destinations and active-route contract.
import { STAGE_ONE_FIXED_PUBLIC_PATHS, type PublicPath } from "../../domain";

export type SiteNavigationItem = {
  key: "latest" | "methodology" | "about" | "changelog" | "export";
  label: string;
  href: PublicPath;
};

export const HEADER_NAVIGATION_ITEMS = Object.freeze([
  { key: "latest", label: "Latest", href: STAGE_ONE_FIXED_PUBLIC_PATHS.latest },
  {
    key: "methodology",
    label: "Methodology",
    href: STAGE_ONE_FIXED_PUBLIC_PATHS.methodology_current,
  },
  { key: "about", label: "About", href: STAGE_ONE_FIXED_PUBLIC_PATHS.about },
  { key: "changelog", label: "Changelog", href: STAGE_ONE_FIXED_PUBLIC_PATHS.changelog },
  { key: "export", label: "Export JSON", href: STAGE_ONE_FIXED_PUBLIC_PATHS.export },
] satisfies readonly SiteNavigationItem[]);

export const FOOTER_NAVIGATION_ITEMS = Object.freeze([
  { key: "about", label: "About", href: STAGE_ONE_FIXED_PUBLIC_PATHS.about },
  {
    key: "methodology",
    label: "Methodology",
    href: STAGE_ONE_FIXED_PUBLIC_PATHS.methodology_current,
  },
  { key: "changelog", label: "Changelog", href: STAGE_ONE_FIXED_PUBLIC_PATHS.changelog },
  { key: "export", label: "Export JSON", href: STAGE_ONE_FIXED_PUBLIC_PATHS.export },
] satisfies readonly SiteNavigationItem[]);

export type ActiveNavigationKey = Exclude<SiteNavigationItem["key"], "latest">;

export function getActiveNavigationKey(pathname: string): ActiveNavigationKey | undefined {
  if (
    pathname === STAGE_ONE_FIXED_PUBLIC_PATHS.methodology_current ||
    pathname === STAGE_ONE_FIXED_PUBLIC_PATHS.methodology_version
  ) {
    return "methodology";
  }

  if (pathname === STAGE_ONE_FIXED_PUBLIC_PATHS.about) return "about";
  if (pathname === STAGE_ONE_FIXED_PUBLIC_PATHS.changelog) return "changelog";
  if (pathname === STAGE_ONE_FIXED_PUBLIC_PATHS.export) return "export";

  return undefined;
}
