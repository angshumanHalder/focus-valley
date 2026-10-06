import { createRoot } from "react-dom/client";
import "./style.css";
import { FocusForm } from "./components/FocusForm";

function App() {
  return (
    <main>
      <header>
        <p className="eyebrow">A little time to grow</p>
        <h1>Focus Valley</h1>
        <p>Settle into a focus session. Your farm will grow here soon.</p>
      </header>

      <section aria-labelledby="timer-heading" className="timer-panel">
        <FocusForm />
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
