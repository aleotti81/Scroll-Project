import Link from "next/link";
import { Icon } from "./components/icons";

export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav" aria-label="Navigazione principale">
        <Link className="wordmark" href="/">scroll<span>studio</span></Link>
        <Link className="nav-cta" href="/crea">Inizia a progettare <Icon name="arrow-up-right" /></Link>
      </nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <p className="eyebrow"><span className="eyebrow-dot" /> RACCONTA IL TUO MONDO, IN MODO NUOVO</p>
          <h1>Il tuo sito.<br /><em>Una storia che scorre.</em></h1>
          <p className="hero-intro">
            Siti scroll-telling cinematici, pensati per far vivere ogni luogo,
            ogni idea, ogni dettaglio.
          </p>
          <Link className="button button-dark" href="/crea">
            Crea il tuo progetto <Icon name="arrow-up-right" />
          </Link>
          <div className="hero-note"><span className="note-line" /> Un brief semplice. Una storia tutta tua.</div>
        </div>
        <div className="hero-art" aria-label="Illustrazione di una storia che scorre">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-sun" />
          <div className="art-hill hill-back" />
          <div className="art-hill hill-front" />
          <div className="art-card">
            <span>01 — IL TUO MONDO</span>
            <strong>Una storia<br />in movimento.</strong>
            <i>SCROLL PER SCOPRIRE <Icon name="arrow-down" /></i>
          </div>
          <span className="art-caption">Scroll Studio · 2025</span>
        </div>
      </section>
      <footer className="landing-footer">
        <span>STORIE DIGITALI, FATTE PER ESSERE VISSUTE.</span>
        <span>SCROLL STUDIO © 2025</span>
      </footer>
    </main>
  );
}
