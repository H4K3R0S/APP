// ==========          IMPERIUM — POČETNA (prazan skelet)          ==========
//
// IMPERIUM je za sada prazan domen (YouTube/streaming/marketing dolaze kasnije).
// Ova stranica je mesto-držač i u CORE-u i u samostalnoj ćeliji — koristi iste
// App.css klase kao ostali ekrani, bez ijednog CORE-only uvoza (da ostane
// bezbedna za ćeliju).

function ImperiumHome() {
  return (
    <div className="workspace-empty" role="status">
      <h1>IMPERIUM</h1>
      <p>
        Prazan domen — YouTube, streaming, content creation, SEO, marketing i
        analytics dolaze kasnije. Ovo je samostalna ćelija spremna za razvoj.
      </p>
    </div>
  );
}

export default ImperiumHome;
