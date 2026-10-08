import test from "node:test";
import assert from "node:assert/strict";
import { recolorFarmer } from "./avatar.ts";

test("hair recoloring preserves boots, skin shadows and thin eye lines in every atlas row", () => {
  const width = 32;
  const image = { data: new Uint8ClampedArray(width * 1122 * 4) };
  const context = { canvas: { width, height: 1122 }, getImageData: () => image, putImageData: () => {} };
  const setPixel = (x, y, color) => image.data.set(color, (y * width + x) * 4);
  const originalHair = [62, 37, 29, 255];
  const outline = [24, 17, 14, 255];
  const skinShadow = [90, 49, 28, 255];
  for (let row = 0; row < 4; row++) {
    const start = 30 + row * 257;
    for (let y = 56; y <= 64; y++)
      for (let x = 12; x <= 20; x++) setPixel(x, start + y, originalHair);
    setPixel(16, start + 80, outline);
    for (let x = 12; x <= 20; x++) setPixel(x, start + 100, originalHair);
    setPixel(16, start + 115, skinShadow);
    setPixel(16, start + 220, originalHair);
  }
  recolorFarmer(context, { hair: "golden", skin: "brown", shirt: "tomato", pants: "denim" });
  for (let row = 0; row < 4; row++) {
    const start = 30 + row * 257;
    const pixel = y => {
      const offset = ((start + y) * width + 16) * 4;
      return Array.from(image.data.slice(offset, offset + 4));
    };
    assert.notDeepEqual(pixel(60), originalHair);
    assert.deepEqual(pixel(80), outline);
    assert.deepEqual(pixel(100), originalHair);
    assert.deepEqual(pixel(115), skinShadow);
    assert.deepEqual(pixel(220), originalHair);
  }
});
