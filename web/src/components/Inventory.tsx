import { useEffect, useRef, useState } from "react";
import { INVENTORY_ITEMS, SEASONS } from "../game/farm";
import { chartRange, inventoryStats, targetItemId, type ChartPeriod } from "../game/inventory";
import { ItemSprite } from "./ItemSprite";
import { LockOverlay } from "./LockOverlay";

function Chart({ values }: { values: { label: string; minutes: number }[] }) {
  const peak = Math.max(60, ...values.map(v => v.minutes));
  const tick = Math.ceil(peak / 4 / 15) * 15, max = tick * 4;
  const step = 640 / values.length, barWidth = Math.min(48, step * .6);
  return <div className="inventory-chart-scroll"><svg className="inventory-chart" viewBox="0 0 720 300" role="img" aria-label={`Focus minutes. ${values.map(v => `${v.label}: ${v.minutes} minutes`).join("; ")}`}>
    <text x="54" y="18" className="chart-axis">MINUTES</text>
    {Array.from({ length: 5 }, (_, index) => {
      const y = 254 - index * 52;
      return <g key={index}><line x1="54" x2="694" y1={y} y2={y} className="chart-grid" />
        <text x="44" y={y + 4} textAnchor="end" className="chart-axis">{index * tick}</text></g>;
    })}
    {values.map(({ label, minutes }, index) => {
      const x = 54 + (index + .5) * step, height = minutes / max * 208;
      return <g key={label}><title>{label}: {minutes.toFixed(1)} focus minutes</title>
        <rect x={x - barWidth / 2} y={254 - height} width={barWidth} height={height} rx="3" className="chart-bar" />
        <text x={x} y={244 - height} textAnchor="middle" className="chart-value">{Number(minutes.toFixed(1))}</text>
        <text x={x} y="278" textAnchor="middle" className="chart-axis">{label}</text>
      </g>;
    })}
  </svg></div>;
}

export function Inventory({ farm, onClose }: { farm: FarmState; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [season, setSeason] = useState(farm.progress.season);
  const [itemId, setItemId] = useState<string | undefined>();
  const [period, setPeriod] = useState<ChartPeriod>("week");
  const [anchor, setAnchor] = useState(farm.farmDay.date);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const stats = inventoryStats(farm, period, anchor, itemId);
  const values = stats.values;
  const minutes = values.reduce((sum, bar) => sum + bar.minutes, 0);
  const formatDate = (date: string, options: Intl.DateTimeFormatOptions) => new Date(date + "T00:00:00Z").toLocaleDateString("en", { ...options, timeZone: "UTC" });
  const rangeLabel = period === "year" ? stats.from.slice(0, 4) : period === "month"
    ? formatDate(stats.from, { month: "long", year: "numeric" })
    : `${formatDate(stats.from, { month: "short", day: "numeric", year: "numeric" })} – ${formatDate(stats.to, { month: "short", day: "numeric", year: "numeric" })}`;
  const item = INVENTORY_ITEMS.find(i => i.id === itemId);
  const quantity = itemId ? farm.inventory[itemId] ?? 0 : Object.values(farm.inventory).reduce((a, b) => a + b, 0);
  return <dialog ref={dialog} className="inventory-dialog" aria-labelledby="inventory-title" onCancel={onClose}>
    <div className="inventory-heading"><h2 id="inventory-title">Inventory</h2><button type="button" onClick={onClose} autoFocus>Close inventory</button></div>
    <p>Saved on this device · download a backup to transfer it.</p>
    <nav className="choices" aria-label="Inventory seasons">{SEASONS.map(s => <button key={s} type="button" aria-pressed={s === season} onClick={() => { setSeason(s); setItemId(undefined); }}>{s}</button>)}</nav>
    {(["crop", "animal"] as const).map(kind => <section key={kind}><h3>{kind === "crop" ? "Crops" : "Animal products"}</h3><div className="inventory-items">
      {INVENTORY_ITEMS.filter(i => i.season === season && i.kind === kind).map(i => {
        const sessions = farm.sessions.filter(s => targetItemId(s.target) === i.id);
        const minutes = sessions.reduce((total, s) => total + s.focusSeconds / 60, 0);
        const locked = kind === "animal" && !farm.progress.unlockedAnimals.includes(i.source);
        return <button key={i.id} type="button" aria-pressed={itemId === i.id} disabled={locked} onClick={() => setItemId(i.id)}><ItemSprite item={i.source} animal={kind === "animal"} /><strong>{i.name}</strong><span>{farm.inventory[i.id] ?? 0} collected</span><small>{minutes.toFixed(1)} focus min · {sessions.length} tasks</small>{locked && <LockOverlay />}</button>;
      })}
    </div></section>)}
    <section className="inventory-activity" aria-label="Activity statistics"><div className="inventory-heading"><h3>{item?.name ?? "All activity"}</h3>{item && <button type="button" onClick={() => setItemId(undefined)}>Show all activity</button>}</div>
      <p>{quantity} collected in total</p>
      <div className="activity-toolbar">
        <fieldset className="period-picker"><legend>Time range</legend><div className="period-options">
          {(["week", "month", "year"] as const).map(value => <label key={value}>
            <input type="radio" name="chart-period" value={value} checked={period === value} onChange={() => setPeriod(value)} />
            <span>{value[0].toUpperCase() + value.slice(1)}</span>
          </label>)}
        </div></fieldset>
        <div className="period-navigation">
          <button type="button" aria-label={`Previous ${period}`} onClick={() => setAnchor(chartRange(period, anchor, -1).from)}>‹</button>
          <span aria-live="polite">{rangeLabel}</span>
          <button type="button" aria-label={`Next ${period}`} onClick={() => setAnchor(chartRange(period, anchor, 1).from)}>›</button>
        </div>
      </div>
      <div className="activity-chart-panel">
        <div className="inventory-heading"><div><h4>Focus time</h4><p className="activity-total">{Number(minutes.toFixed(1))} <span>minutes</span></p></div>
        </div>
        <p className="chart-caption">{stats.completions} completed tasks in this period · growth bonuses excluded.</p>
        <Chart values={values} />
        {minutes === 0 && <p className="chart-caption">No focus time in this period yet. Complete a timer to see your progress.</p>}
        {period === "month" && <p className="chart-caption">Days 1–7, 8–14, 15–21 and 22–month-end.</p>}
      </div>
    </section>
  </dialog>;
}
