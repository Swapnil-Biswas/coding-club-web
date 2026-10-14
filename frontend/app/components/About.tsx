import Image from "next/image";
import RevealOnScroll from "./RevealOnScroll";

export default function About() {
  return (
    <section className="about" id="about">
      <div className="about-dot-bg" aria-hidden="true" />
      <div className="about-content">
        <div className="about-text">
          <RevealOnScroll>
            <span className="section-eyebrow">// 01 — About</span>
            <h2 className="section-heading">
              Building more
              <br />
              than code.
              <br />
              <span className="about-heading-ghost">Building community.</span>
            </h2>
          </RevealOnScroll>
          <RevealOnScroll delay={120}>
            <p className="section-body">
              Coding Club BMSIT is a student-driven initiative that brings
              together passionate developers, designers, and tech enthusiasts.
              From live coding sessions and hands-on workshops to real-world
              projects and hackathons — we believe in learning by doing.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={200}>
            <p className="section-body">
              Whether you&apos;re writing your first line of code or shipping
              production-ready apps, there&apos;s a place for you here.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={280}>
            <div className="about-pillars">
              <div className="about-pillar">
                <span className="about-pillar-num">01</span>
                <div>
                  <h4>Learn by shipping</h4>
                  <p>Every concept is paired with a real artifact you can show off.</p>
                </div>
              </div>
              <div className="about-pillar">
                <span className="about-pillar-num">02</span>
                <div>
                  <h4>Members, not followers</h4>
                  <p>You bring the work. We bring the room, the mentors, the coffee.</p>
                </div>
              </div>
              <div className="about-pillar">
                <span className="about-pillar-num">03</span>
                <div>
                  <h4>Open by default</h4>
                  <p>Talks, code, and notes are public. Knowledge compounds when shared.</p>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
        <RevealOnScroll delay={150} className="about-image-wrapper">
          <Image
            src="/IMG_7978.JPG (1).jpeg"
            alt="Coding Club BMSIT community at Decode2Deploy event"
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            style={{ objectFit: "cover" }}
            priority={false}
          />
          <div className="about-image-dots" aria-hidden="true" />
          <div className="about-image-corners" aria-hidden="true">
            <span /><span /><span /><span />
          </div>
          <div className="about-image-tag">
            <span>FIG. 01</span>
            <span>— COMMUNITY · 2025</span>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
