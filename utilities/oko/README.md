# 👁 OKO — screenshot/capture daemon

Samostalna, laka GTK3 aplikacija koja **radi u pozadini** i hvata ekran/prozor/region.
Poziva se globalnim tasterom (default **Insert**); `ai_workplace`/AI je koristi preko malog
lokalnog IPC-a (:4807). Zaseban git repo: `~/ai/APPS/utilities/oko`.

## Šta radi
- **Insert** → **region** izbor (zamrznut screenshot, povučeš pravougaonik) →
  **Enter=Fajl · C=Clipboard · E=Uredi · Esc=Otkaži** (ili klik na pilule 💾/📋/✏️).
- **AI Windows Cache** (kad je fokus na NAŠOJ cell-shell app): Insert nudi **DOM element/sekcija
  birač** (hover=element, drag=region); izbor otvara isti editor.
- **✏️ Uredi / editor**: centriran providni anotacioni panel — olovka/linija/strelica/
  pravoug./krug/tekst, boje (9 + spektar-piker), debljina, **crop**, **region copy/paste**
  (CTRL+C/V), **zoom** (točkić/dugmad/pan), CTRL+Z → **Sačuvaj (Fajl) / Clipboard**.
- Modovi **window** (aktivni prozor) i **screen** (ceo monitor) — bez izbora (za IPC/headless).
- **Domen-detekcija**: naslov/WM_CLASS aktivnog prozora → domen, upisano u meta snimka.
- **Tray**: brzo hvatanje, Podešavanja, Izlaz.

## Pokretanje
```bash
# dvoklik OKO.desktop  (ili:)
~/ai/APPS/utilities/oko/oko.sh
```
`oko.sh` prvo pokrene **proveru zavisnosti** (`scripts/check_deps.sh`): ako fale sistemski
paketi, otvori mali prozorčić sa **copy-paste komandom + „INSTALL" dugmetom**
(`scripts/deps_dialog.py`, `pkexec apt-get`); potom sam napravi `.venv` i instalira `python-xlib`.

Kao servis (autostart, na zahtev):
```bash
mkdir -p ~/.config/systemd/user
cp service/oko.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now oko.service
```

## Komande — IPC (`127.0.0.1:4807`)  ← programski interfejs (MCP-uputstvo)
| Metod · ruta | Telo / parametri | Vraća |
|---|---|---|
| `GET /health` | — | `{ok, hotkey, mode, port, pid}` |
| `GET /last` | — | poslednji snimak `{path|clipboard, domain, ts, size}` |
| `POST /capture` | `{mode: region\|window\|screen, dest?: file\|clipboard, path?, interactive?}` | rezultat snimka (ili `{cancelled}`/`{busy}`) |
| `GET /settings` · `POST /settings` | ceo config / delimičan patch | novi config |
| `GET /pick/wait?pid=<pid>` | (long-poll; cell-shell) | `{action:"pick", request_id, cancel_key}` ili `{}` |
| `POST /pick/result` | `{request_id, rect\|cancel}` | `{ok}` |
| `GET /` | — | Settings web strana |

**Headless snimak** (bez interakcije — koristi ga `commit_shots.py`):
```bash
curl -s -X POST 127.0.0.1:4807/capture \
  -H 'Content-Type: application/json' \
  -d '{"mode":"window","dest":"file","path":"/tmp/x.png","interactive":false}'
```
`region` mod je interaktivan; `window`/`screen` su neinteraktivni (za skripte/IPC).

## Komande — CLI (`cli/oko`, tanak klijent)
```
oko health
oko capture --mode window
oko capture --mode screen --dest file --path /tmp/x.png
oko last
```

## Podešavanja
Web strana `http://127.0.0.1:4807/` (tray → „Podešavanja…"): hotkey, mod, akcija posle
izbora, putanja, format+kvalitet, šablon imena, **AI Windows Cache** (`element_pick`),
prečice `hotkey_ai_cache` (trenutni AI-cache) i `hotkey_cancel`, autostart. Primeni odmah.

## Struktura
```
oko/
  daemon/    config · state · domain_detect · capture · capture_flow · clipboard
             save_dialog · region_overlay · editor_model · editor_overlay
             pick_registry · hotkey · ipc · tray · util · __main__
  web/       settings.html/.css/.js
  cli/oko    IPC klijent
  scripts/   check_deps.sh · deps_dialog.py   (provera/instalacija zavisnosti)
  service/   oko.service   (systemd --user)
  tests/     pytest — 59
```

## Zavisnosti (nezavisnost)
- Sistemski (apt): `python3-gi`, `gir1.2-gtk-3.0`, `xdotool`.
- venv (pip): `python-xlib`. venv je `--system-site-packages` (gi/GTK iz sistema).
- `oko.sh` proverava sve pri pokretanju i nudi instalaciju ako fali.

## Veza: `commit_shots.py`
`ai_workplace/scripts/commit_shots.py` koristi OKO `POST /capture {mode:window}` da uslika
aktivni prozor u `<repo>/.commit-shots/<oznaka>/` uz `manifest.md` (za prikaz izmena pri
online commit-u). Pokreće se na zahtev, za veće izmene.
