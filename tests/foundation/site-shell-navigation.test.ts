// Verifies canonical shell destinations, ordering, and route-derived active navigation states.
import { describe, expect, test } from "vitest";
import { STAGE_ONE_FIXED_PUBLIC_PATHS } from "../../src/domain";
import {
  FOOTER_NAVIGATION_ITEMS,
  HEADER_NAVIGATION_ITEMS,
  getActiveNavigationKey,
} from "../../src/components/site-shell/navigation";

describe("Stage 1 shell navigation", () => {
  test("uses the canonical fixed route contract in the approved order", () => {
    expect(STAGE_ONE_FIXED_PUBLIC_PATHS).toEqual({
      home: "/",
      latest: "/#latest",
      methodology_current: "/methodology/",
      methodology_version: "/methodology/1.0.0/",
      about: "/about/",
      changelog: "/changelog/",
      export: "/export/",
    });
    expect(HEADER_NAVIGATION_ITEMS).toEqual([
      { key: "latest", label: "Latest", href: "/#latest" },
      { key: "methodology", label: "Methodology", href: "/methodology/" },
      { key: "about", label: "About", href: "/about/" },
      { key: "changelog", label: "Changelog", href: "/changelog/" },
      { key: "export", label: "Export JSON", href: "/export/" },
    ]);
    expect(FOOTER_NAVIGATION_ITEMS).toEqual([
      { key: "about", label: "About", href: "/about/" },
      { key: "methodology", label: "Methodology", href: "/methodology/" },
      { key: "changelog", label: "Changelog", href: "/changelog/" },
      { key: "export", label: "Export JSON", href: "/export/" },
    ]);
  });

  test.each([
    ["/", undefined],
    ["/#latest", undefined],
    ["/latest/", undefined],
    ["/entries/representative-entry/", undefined],
    ["/topic-trails/representative-trail/", undefined],
    ["/methodology/", "methodology"],
    ["/methodology/1.0.0/", "methodology"],
    ["/about/", "about"],
    ["/changelog/", "changelog"],
    ["/export/", "export"],
  ] as const)("maps %s to %s", (pathname, expectedActiveKey) => {
    expect(getActiveNavigationKey(pathname)).toBe(expectedActiveKey);
  });
});
