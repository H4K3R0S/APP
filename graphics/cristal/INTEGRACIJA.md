# Integracija app-ova (app-bus + handoff)

Kako Cristal komunicira sa drugim aplikacijama (Screenshot, Nabavka…) i
kako da isti protokol povežе SVE app-ove u `Desktop\APP\`. Cilj: jednostavno,
lokalno, bez mreže ka spolja, radi i kad je app već otvoren ili ugašen.

## Tri sloja (od najprostijeg)

### A) Handoff preko CLI argumenta (najprostije — MVP)
Pozivalac pokrene ciljni app sa putanjom:
```
PhotoEditor.exe --open "C:\...\snimak.png"
```
- Ciljni `src-tauri/lib.rs` pročita `std::env::args()`, nađe `--open <put>`, i
  prosledi web sloju (Tauri `app.emit("open-file", put)` ili početni state).
- Web sloj učita sliku preko `shot_read(put, root)` → novi projekat/platno.
- **Mana:** ako je app već otvoren, novi proces se ne startuje čисto (single-instance
  plugin `tauri-plugin-single-instance` prosledi argument postojećem prozoru — preporuka).

### B) Zajednički „inbox" folder (radi i kad je app otvoren)
Dogovoreni folder, npr. `Desktop\APP\_shared\inbox\<app>\`:
- Pozivalac upiše sliku + mali `zahtev.json`:
  ```json
  {"id":"uuid","from":"screenshot","action":"open","path":"C:\\...\\snimak.png","ts":"2026-09-17T13:40:00"}
  ```
- Ciljni app **prati** svoj inbox (`@tauri-apps/plugin-fs` watch ili Rust `notify`),
  pokupi `zahtev.json`, učita sliku, obriše zahtev.
- **Prednost:** ne zavisi od pokretanja procesa; više zahteva u redu.

### C) Lokalni app-bus (HTTP, za bogatu 2-smernu razmenu)
Svaki app diže mali lokalni port (kao Nabavka/Finansije FastAPI) i izlaže:
```
POST /bus/message   {from, to, action, payload, reply_to?}
GET  /bus/status
```
- Registar portova u `Desktop\APP\_shared\registry.json`:
  ```json
  {"screenshot": 8801, "photo-editor": 8802, "nabavka": 8790, "finansije": 8791}
  ```
- Pozivalac pošalje `POST http://127.0.0.1:8802/bus/message` sa
  `{"from":"screenshot","to":"photo-editor","action":"open","payload":{"path":"..."}}`.
- **Round-trip** (odgovor): `reply_to` = pozivaočev bus URL; ciljni app po završetku
  pošalje nazad `{"action":"result","payload":{"saved":"C:\\...\\uredjeno.png"}}`.
- **Prednost:** puna 2-smerna komunikacija (npr. Nabavka: „uredi sliku proizvoda" →
  Cristal uredi → vrati putanju → Nabavka je zameni). Isti obrazac kao
  „domeni komuniciraju preko lokalnog API-ja" iz reforme.

## Preporuka po fazi
- **F5 (integracija) start:** A) `--open` + `single-instance` — najbrže, dovoljno za
  Screenshot→Photo.
- **Kad zatreba red/otvoren app:** dodaj B) inbox watch.
- **Kad zatreba odgovor nazad (Nabavka round-trip):** dodaj C) app-bus (mali port).

## Konkretno: Screenshot → Cristal
1. U Screenshot-u, dugme „Otvori u editoru": snimak je već na disku
   (`shot_capture.save_dir`).
2. Screenshot pozove Cristal: `PhotoEditor.exe --open "<put_snimka>"`
   (Rust `std::process::Command` ili web `@tauri-apps/plugin-shell`), ILI upiše
   `zahtev.json` u `_shared\inbox\photo-editor\`.
3. Cristal učita snimak (`shot_read`) kao osnovu novog projekta.
4. (Opc.) po „Save", Cristal preko app-bus-a javi Screenshot-u putanju rezultata.

## Zajednička konvencija (da svi app-ovi rade isto)
- Folder `Desktop\APP\_shared\` (inbox/, registry.json, slike/).
- Poruka uvek `{id, from, to, action, payload, ts, reply_to?}`.
- Akcije: `open` (učitaj sliku), `edit` (uredi pa vrati), `result` (odgovor), `ping`.
- Sve lokalno (127.0.0.1), bez auth (kao ćelije) — samo tvoja mašina.
