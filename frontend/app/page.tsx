import Hero from "./components/Hero";
import StatsBar from "./components/StatsBar";
import About from "./components/About";
import Events from "./components/Events";
import Projects from "./components/Projects";
import Team from "./components/Team";
import Resources from "./components/Resources";
import Domains from "./components/Domains";
import Partners from "./components/Partners";
import JoinUs from "./components/JoinUs";
import GlyphDivider from "./components/GlyphDivider";

export default function Home() {
  return (
    <main>
      <Hero />
      <StatsBar />
      <About />
      <Events />
      <Projects />
      <Team />
      <Resources />
      <Domains />
      <Partners />
      <JoinUs />
    </main>
  );
}
