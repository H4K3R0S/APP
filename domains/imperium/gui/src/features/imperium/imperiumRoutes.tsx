import { Route } from "react-router";

import ImperiumHome from "./ImperiumHome";
import ImperiumSettings from "./ImperiumSettings";


// ==========          IMPERIUM RUTE (deljeni izvor)          ==========
//
// Jedini izvor IMPERIUM ruta. Koristi ih i CORE `App` (kad je IMPERIUM aktivan
// domen) i samostalna ćelija (`CellApp` preko `cellDomain`). IMPERIUM je prazan
// skelet, pa za sada nosi samo početnu stranu.

export function imperiumRoutes() {
  return (
    <>
      <Route path="/imperium" element={<ImperiumHome />} />
      <Route path="/imperium/settings" element={<ImperiumSettings />} />
    </>
  );
}
