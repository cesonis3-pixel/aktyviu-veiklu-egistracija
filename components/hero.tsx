import Image from "next/image";
import Link from "next/link";
import { Icon } from "./icon";
export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <Image
        src="/images/winter-mountains.jpg"
        alt=""
        fill
        preload
        sizes="100vw"
        className="hero-image"
      />
      <div className="hero-overlay" />
      <div className="container hero-content">
        <h1 id="hero-title">
          Atrask žiemos
          <br />
          nuotykius
        </h1>
        <p>Slidinėjimas, žygiai ir kitos veiklos vienoje vietoje</p>
        <Link href="/activities" className="button button-ice">
          Peržiūrėti veiklas <Icon name="arrow" />
        </Link>
      </div>
    </section>
  );
}
