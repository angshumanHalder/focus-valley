import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { useState } from "react";
import "./style.css";
import { FarmCanvas } from "./components/FarmCanvas";
import { GuestFarm } from "./components/GuestFarm";
import { createFarm, SEASON_CONTENT } from "./game/farm";
import meadowGround from "../../art/source/meadow-ground.png?url";
import sandyGround from "../../art/source/sandy-path-sample.png?url";
import autumnGround from "../../art/source/autumn-ground.png?url";
import winterGround from "../../art/source/winter-ground.png?url";

const GROUND: Record<Season, string> = {
  spring: meadowGround, summer: sandyGround, rainy: meadowGround,
  autumn: autumnGround, winter: winterGround,
};

function App() {
  const [entry, setEntry] = useState<"guest" | "demo" | null>(null);
  const [season, setSeason] = useState<Season>("spring");
  function enter(mode: "guest" | "demo") {
    const update = () => { window.scrollTo(0, 0); flushSync(() => setEntry(mode)); };
    if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      document.startViewTransition(update);
    else update();
  }
  const [farm] = useState(() => {
    const farm = createFarm(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
    farm.progress.unlockedAreaCount = 4;
    farm.progress.unlockedAnimals = ["chicken", "rabbit"];
    farm.farmDay.tiles = Array.from({ length: 16 }, (_, index) => ({
      areaId: Math.floor(index / 4), tileId: index % 4,
      cropId: SEASON_CONTENT.spring.crops[index % 4], focusSeconds: 0, harvested: false,
    }));
    return farm;
  });
  return (
    <>
      <div className="season-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${GROUND[season]})` }} />
      <main className="game-world">
        {entry ? <GuestFarm onSeasonChange={setSeason} mode={entry} /> : <>
          <div className="title-farm" aria-hidden="true" inert><FarmCanvas farm={farm} active={null} autoplay /></div>
          <section className="title-screen" aria-labelledby="game-title">
            <div className="title-menu">
              <p className="title-kicker">A little time to grow</p>
              <h1 id="game-title">FOCUS<br /><span>VALLEY</span></h1>
              <div className="title-actions">
                <button type="button" aria-describedby="google-status" onClick={() => enter("demo")}>Continue with Google</button>
                <button type="button" className="guest-entry" onClick={() => enter("guest")}>Try as guest</button>
              </div>
              <p>Try the farm. Progress won’t be saved.</p>
              <small id="google-status">Google sign-in is a demo for now. No account is connected or saved.</small>
            </div>
          </section>
        </>}
      </main>
      {season === "rainy" && <div className="rain-overlay" aria-hidden="true" />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
