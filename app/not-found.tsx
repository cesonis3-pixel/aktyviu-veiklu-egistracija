import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="container page-section">
      <div className="empty-state">
        <h1>Puslapis nerastas</h1>
        <p>Šios veiklos arba puslapio nėra. Atrask kitą žiemos nuotykį.</p>
        <Link href="/activities" className="button">
          Grįžti į veiklas
        </Link>
      </div>
    </main>
  );
}
