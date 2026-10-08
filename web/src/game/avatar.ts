export const APPEARANCE_OPTIONS = {
  hair: [
    { id: "black", label: "Black", color: "#211c1b" },
    { id: "brown", label: "Brown", color: "#563a2c" },
    { id: "golden", label: "Golden", color: "#ddbb80" },
  ],
  skin: [
    { id: "light", label: "Light", color: "#e5bd9b" },
    { id: "brown", label: "Brown", color: "#bd7848" },
    { id: "deep", label: "Deep", color: "#70402e" },
  ],
  shirt: [
    { id: "tomato", label: "Tomato", color: "#c94f43" },
    { id: "sunflower", label: "Sunflower", color: "#d9a83f" },
    { id: "sage", label: "Sage", color: "#71946a" },
  ],
  pants: [
    { id: "denim", label: "Denim", color: "#46627d" },
    { id: "cocoa", label: "Cocoa", color: "#765847" },
    { id: "charcoal", label: "Charcoal", color: "#49545b" },
  ],
} as const;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
function hsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), light = (max + min) / 2;
  if (max === min) return [0, 0, light];
  const delta = max - min;
  const saturation = delta / (1 - Math.abs(2 * light - 1));
  const hue = max === r ? ((g - b) / delta + (g < b ? 6 : 0)) / 6
    : max === g ? ((b - r) / delta + 2) / 6 : ((r - g) / delta + 4) / 6;
  return [hue, saturation, light];
}
function rgb(hue: number, saturation: number, light: number) {
  const chroma = (1 - Math.abs(2 * light - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue * 6) % 2 - 1));
  const [r, g, b] = hue < 1 / 6 ? [chroma, x, 0] : hue < 2 / 6 ? [x, chroma, 0]
    : hue < 3 / 6 ? [0, chroma, x] : hue < 4 / 6 ? [0, x, chroma]
      : hue < 5 / 6 ? [x, 0, chroma] : [chroma, 0, x];
  const m = light - chroma / 2;
  return [r, g, b].map(v => Math.round((v + m) * 255));
}

export function recolorFarmer(context: CanvasRenderingContext2D, appearance: FarmerAppearance) {
  const { width, height } = context.canvas;
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const hairMask = new Uint8Array(width * height);
  // Hair and boots share browns. Limit the source-color mask to each atlas head.
  for (let pixel = 0; pixel < hairMask.length; pixel++) {
    const y = Math.floor(pixel / width) - 30;
    if (y < 0 || y >= 4 * 257 || y % 257 >= 140 || data[pixel * 4 + 3] < 32) continue;
    const [hue, saturation, light] = hsl(data[pixel * 4], data[pixel * 4 + 1], data[pixel * 4 + 2]);
    hairMask[pixel] = Number(hue >= .02 && hue <= .09 && saturation > .16 && saturation < .46 && light < .3);
  }
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 32) continue;
    let [hue, saturation, light] = hsl(data[i], data[i + 1], data[i + 2]);
    const pixel = i / 4;
    // Preserve thin eye/face lines and the hair outline, even when their colors match.
    const hair = hairMask[pixel] && hairMask[pixel - 3] && hairMask[pixel + 3] &&
      hairMask[pixel - width * 3] && hairMask[pixel + width * 3];
    let changed = true;
    if (hair && appearance.hair !== "brown") {
      if (light < .09) continue; // Preserve the dark silhouette and facial outlines.
      if (appearance.hair === "black") { hue = .04; saturation *= .25; light *= .48; }
      else {
        const shade = clamp((light - .09) / .13);
        // Warm brown shadows through pale blonde highlights, without a yellow tint.
        [data[i], data[i + 1], data[i + 2]] = [90 + shade * 157, 57 + shade * 162, 38 + shade * 113];
        continue;
      }
    } else if (hue >= .035 && hue <= .13 && saturation > .2 && light >= .3 && appearance.skin !== "brown") {
      if (appearance.skin === "light") { saturation *= .58; light = clamp(light * 1.22); }
      else { saturation *= .88; light *= .68; }
    } else if ((hue >= .96 || hue <= .025) && saturation > .3 && light > .12 && appearance.shirt !== "tomato") {
      hue = appearance.shirt === "sunflower" ? .12 : .30;
      saturation = appearance.shirt === "sage" ? saturation * .48 : saturation * .85;
    } else if (hue >= .5 && hue <= .66 && saturation > .2 && appearance.pants !== "denim") {
      hue = appearance.pants === "cocoa" ? .07 : .57;
      saturation = appearance.pants === "charcoal" ? saturation * .28 : saturation * .62;
    } else changed = false;
    if (changed) [data[i], data[i + 1], data[i + 2]] = rgb(hue, saturation, light);
  }
  context.putImageData(image, 0, 0);
}
