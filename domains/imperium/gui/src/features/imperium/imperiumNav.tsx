import { Brain, LayoutDashboard, Settings } from "lucide-react";

import { type CellNav } from "../../cell/cellNav";
import ImperiumAgentDock from "./ImperiumAgentDock";


// ==========          IMPERIUM NAVIGACIJA (deljeni izvor)          ==========
//
// Jedini izvor IMPERIUM stavki sidebara. Koristi ga i CORE `Sidebar` (kad je
// IMPERIUM aktivan domen) i generički `CellSidebar` (samostalna ćelija).
// IMPERIUM je prazan skelet — za sada samo početna.

export const imperiumNav: CellNav = {
  brand: "IMPERIUM",
  AgentDock: ImperiumAgentDock,
  homePath: "/imperium",
  settingsPath: "/imperium/settings",
  railItems: [
    { label: "Početna", icon: LayoutDashboard, path: "/imperium", end: true },
    { label: "Second Brain", icon: Brain, path: "/second-brain" },
    { label: "Podešavanja", icon: Settings, path: "/imperium/settings" },
  ],
  sections: [
    {
      label: "IMPERIUM",
      items: [
        { id: "imp-home", label: "Početna", icon: LayoutDashboard, path: "/imperium" },
        { id: "imp-settings", label: "Podešavanja", icon: Settings, path: "/imperium/settings" },
      ],
    },
  ],
};
