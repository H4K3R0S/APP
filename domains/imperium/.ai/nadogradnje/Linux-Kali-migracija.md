# NADOGRADNJA (sledeća po rasporedu) — Linux/Kali migracija + native zavisnosti

> Mesto u planu razvoja: **sledeća stavka po rasporedu.** Cilj: IMPERIUM ćelija
> radi na Kali/Debian Linux-u. Popis Windows-zavisnog, šta se menja, šta ne.

## 1. Native binarne iz CORE `bin/` koje pripadaju IMPERIUM-u

IMPERIUM nosi glas/titlove (STT+TTS), pa mu pripadaju dva `bin/` alata:

### whisper (STT — govor u tekst, titlovi/CC)
- **Windows sada:** `CORE/bin/whisper/` = whisper.cpp build + **CUDA DLL-ovi**
  (`cudart64_12.dll`, `cublas64_12.dll`, `ggml-*.dll`, `SDL2.dll`, `*.exe`).
- **Uputstvo (Windows):** portable whisper.cpp sa CUDA ubrzanjem; `.exe` + DLL-ovi u
  `bin/whisper/`; koristi GPU (VRAM kontrola — učitaj model, transkribuj, oslobodi VRAM).
- **Linux/Kali:** DLL-ovi otpadaju. Dve opcije:
  - **whisper.cpp (native build):**
    ```bash
    sudo apt install -y build-essential cmake libsdl2-dev
    git clone https://github.com/ggerganov/whisper.cpp && cd whisper.cpp
    # CPU:
    cmake -B build && cmake --build build -j
    # NVIDIA GPU (CUDA toolkit instaliran):
    cmake -B build -DGGML_CUDA=1 && cmake --build build -j
    ```
    CUDA na Linux-u = `.so` (`libcudart.so`, `libcublas.so`) preko `nvidia-cuda-toolkit`.
  - **OpenAI `whisper` (Python) / `faster-whisper`:** `pip install faster-whisper`
    (koristi CTranslate2, radi CPU/GPU, bez ručnih DLL-ova) — **preporuka za Linux**.

### piper (TTS — tekst u govor)
- **Windows sada:** `CORE/bin/piper/` = `piper.exe` + `onnxruntime.dll`,
  `espeak-ng.dll` + `espeak-ng-data/`, `libtashkeel_model.ort`.
- **Uputstvo (Windows):** portable piper; `.exe` čita ONNX glasovni model + espeak-ng podatke.
- **Linux/Kali:**
  ```bash
  sudo apt install -y espeak-ng
  pip install piper-tts        # ili preuzmi piper linux binarni release
  ```
  ONNX modeli glasova su isti fajlovi (cross-platform); `onnxruntime` na Linux-u = `.so`.

## 2. Ostale zavisnosti — Windows vs Linux

| Alat | Uloga | Windows | Linux/Kali |
|------|-------|---------|------------|
| **CUDA runtime** | GPU za whisper | `*.dll` u bin | `nvidia-cuda-toolkit` (`.so`) |
| **anthropic / openai** | AI klijenti (Python) | pip | isto — **ne menja se** |
| **Node.js / git** | build GUI / opšte | winget/instaler | `apt install nodejs npm git` |
| **ffmpeg** | audio ekstrakcija za STT | winget | `apt install ffmpeg` |

## 3. Kod koji treba dirati (Windows-specifično)
- `core/ai/stt/whisper_service.py` — backend je već injektabilan; dodaj Linux backend
  (`faster-whisper` ili whisper.cpp `.so`), ukloni pretpostavku DLL/`.exe` putanja.
- `core/foundation/dependencies.py` / `installer.py` — probe/hint po `sys.platform`
  (whisper/piper: `which` na Linux-u umesto `bin/*.exe`); `winget` → `apt`/`pip`.
- VRAM/`.dll` staze i separatori → `pathlib`, bez ekstenzije.
- Tauri build: `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `build-essential`.

## 4. Šta NE treba dirati
- FastAPI/uvicorn, SQLite, RAG, GUI (React/Vite).
- ONNX glasovni modeli (isti fajlovi na oba OS-a).
- AI klijenti (`anthropic`, `openai`) — čist Python.

## 5. Redosled primene
1. Zameni whisper.cpp DLL build → `faster-whisper` (pip) ili whisper.cpp `.so` build.
2. `apt install espeak-ng ffmpeg`; `pip install piper-tts faster-whisper`.
3. (Opc.) `nvidia-cuda-toolkit` za GPU.
4. Apstrahuj `dependencies.py` po platformi; test STT (transkript) + TTS (sinteza).
