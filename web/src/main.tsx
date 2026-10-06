import { createRoot } from "react-dom/client";
import { useState } from "react";
import "./style.css";
import { GuestFarm } from "./components/GuestFarm";
import meadowGround from "../../art/source/meadow-ground.png?url";
import sandyGround from "../../art/source/sandy-path-sample.png?url";
import autumnGround from "../../art/source/autumn-ground.png?url";
import winterGround from "../../art/source/winter-ground.png?url";

const GROUND: Record<Season, string> = {
  spring: meadowGround, summer: sandyGround, rainy: meadowGround,
  autumn: autumnGround, winter: winterGround,
};

function App() {
  const [season, setSeason] = useState<Season>("spring");
  return (
    <>
      <div className="season-backdrop" aria-hidden="true" style={{ backgroundImage: `url(${GROUND[season]})` }} />
      <main className={`season-${season}`}>
        <header>
          <p className="eyebrow">A little time to grow</p>
          <h1>Focus Valley</h1>
          <p>Plant a crop, then focus to grow your farm.</p>
        </header>

        <GuestFarm onSeasonChange={setSeason} />
      </main>
      {season === "rainy" && <div className="rain-overlay" aria-hidden="true" />}
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
