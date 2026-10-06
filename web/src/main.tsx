import { createRoot } from "react-dom/client";
import "./style.css";
import { GuestFarm } from "./components/GuestFarm";

function App() {
  return (
    <main>
      <header>
        <p className="eyebrow">A little time to grow</p>
        <h1>Focus Valley</h1>
        <p>Settle into a focus session. Your farm will grow here soon.</p>
      </header>

      <GuestFarm />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
