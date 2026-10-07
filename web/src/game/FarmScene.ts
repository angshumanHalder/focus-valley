import Phaser from "phaser";
import { bedState, growthStage, SEASON_CONTENT } from "./farm.ts";
import { advancePath, farmPaths, nearestPath, pathRoute, pathStep, type Direction, type FarmPaths, type PathPoint } from "./farmPaths.ts";
import { farmerPosition } from "./farmWalk.ts";
import { areaOrigin, frameAreas, penOrigin } from "./sceneLayout.ts";
import { previewGrowth, previewProduce, previewFarmer } from "./scenePreview.ts";
import farmerSheet from "../../../art/source/characters/farmer/farmer-walk-sheet.png?url";
import raisedBed from "../../../art/source/environment/props/raised-bed.png?url";
import sandyPath from "../../../art/source/environment/ground/sandy-path.png?url";
import meadowGround from "../../../art/source/environment/ground/meadow-ground.png?url";

import { SEASONAL_FRAMES, animalPopulation, ANIMAL_PRODUCTS } from "./seasonalFrames.ts";
import autumnGround from "../../../art/source/environment/ground/autumn-ground.png?url";
import winterGround from "../../../art/source/environment/ground/winter-ground.png?url";

import { ROSTERS, CROP_SHEETS, ANIMAL_SHEETS } from "./spriteAssets.ts";
import { recolorFarmer } from "./avatar.ts";

export type Bed = { areaId: number; tileId: number };
export type FarmFrame = ReturnType<typeof frameAreas>;

const BED_WIDTH = 144;
const BED_OFFSETS = [[24, 44], [216, 44], [24, 216], [216, 216]] as const;
// Fit 28px mature sprites inside the soil, excluding image padding and wooden rails.
const PLANT_OFFSETS = Array.from({ length: 16 }, (_, index) => [34 + index % 4 * 25, 44 + Math.floor(index / 4) * 16] as const);

export class FarmScene extends Phaser.Scene {
  private ground?: Phaser.GameObjects.Graphics;
  private plants?: Phaser.GameObjects.Graphics;
  private farmerShadow?: Phaser.GameObjects.Graphics;
  private farmer?: Phaser.GameObjects.Image;
  private butterfly?: Phaser.GameObjects.Graphics;
  private produce?: Phaser.GameObjects.Graphics;
  private shade?: Phaser.GameObjects.Graphics;
  private paths: FarmPaths = new Map();
  private route: PathPoint[] = [];
  private direction?: Direction;
  private running = false;
  private activeAnimal: string | null = null;
  private tending = false;
  private cropImages: { image: Phaser.GameObjects.Image; tile: FarmTile; index: number }[] = [];
  private spriteImages: Phaser.GameObjects.Image[] = [];
  private animalImages: { image: Phaser.GameObjects.Image; sleepMark: Phaser.GameObjects.Text; animalId: string; x: number; y: number; unlocked: boolean; scaleX: number; scaleY: number }[] = [];
  private groundImages: Phaser.GameObjects.Image[] = [];
  private farm?: FarmState;
  private active?: Bed | null;
  private frame?: FarmFrame;
  private reducedMotion = false;
  private autoplay = false;
  private showcase = false;
  private elapsed = 0;
  private walkStart = 0;
  private lastPlantFrame = -1;
  private lastFarmerFrame = "";
  private avatarKey = "";

  constructor() {
    super("FarmScene");
  }

  preload() {
    this.load.image("farmer-sheet", farmerSheet);
    this.load.image("raised-bed", raisedBed);
    this.load.image("sandy-path", sandyPath);
    this.load.image("meadow-ground", meadowGround);
    this.load.image("autumn-ground", autumnGround);
    this.load.image("winter-ground", winterGround);
    for (const [season, url] of Object.entries(ROSTERS)) this.load.image(`roster-${season}`, url);
    for (const [crop, url] of Object.entries(CROP_SHEETS)) this.load.image(`crop-${crop}`, url);
    for (const [animal, url] of Object.entries(ANIMAL_SHEETS)) this.load.image(`animal-${animal}`, url);
  }

  create() {
    const sheet = this.textures.get("farmer-sheet");
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 5; column++)
        sheet.add(`${row}-${column}`, 0, 95 + column * 242, 30 + row * 257, 240, 245);
    for (const crop of Object.keys(CROP_SHEETS))
      this.textures.get(`crop-${crop}`).add("mature", 0, 1403, 500, 256, 320);
    for (const animal of Object.keys(ANIMAL_SHEETS))
      for (let frame = 0; frame < 4; frame++)
        this.textures.get(`animal-${animal}`).add(String(frame), 0, frame * 543, 0, 543, 724);
    for (const season of Object.keys(ROSTERS) as (keyof typeof ROSTERS)[]) {
      const source = this.textures.get(`roster-${season}`).getSourceImage() as HTMLImageElement;
      const frames = SEASONAL_FRAMES[season];
      SEASON_CONTENT[season].crops.forEach((crop, index) => {
        this.textures.addImage(`crop-${crop}`, source)!.add("mature", 0, ...frames.crops[index]);
      });
      SEASON_CONTENT[season].animals.forEach((animal, index) => {
        const texture = this.textures.addImage(`animal-${animal}`, source)!;
        frames.animals[index].forEach((rect, pose) => texture.add(String(pose), 0, ...rect));
      });
    }
    this.ground = this.add.graphics().setDepth(0);
    this.plants = this.add.graphics().setDepth(3);
    this.farmerShadow = this.add.graphics().setDepth(4);
    // Keep the whole farmer above locked-area shading (depth 7).
    this.farmer = this.add.image(192, 192, "farmer-sheet", "0-0").setOrigin(0.5, 1).setDisplaySize(64, 64).setDepth(8);
    this.applyFarmerAppearance(this.farm?.avatar);
    this.butterfly = this.add.graphics().setDepth(6);
    this.produce = this.add.graphics().setDepth(4);
    this.shade = this.add.graphics().setDepth(7);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.autoplay || this.running || !this.farmer) return;
      this.game.canvas.parentElement?.focus({ preventScroll: true });
      const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const target = nearestPath(point, this.paths);
      if (Math.hypot(point.x - target.x, point.y - target.y) > 20) return;
      this.direction = undefined;
      this.route = pathRoute(this.farmer, target, this.paths);
    });
    this.renderFarm();
  }

  pressDirection(direction: Direction) {
    if (!this.running && !this.autoplay) {
      this.direction = direction;
      // Finish the current short segment before turning at a path junction.
      this.route = this.route.slice(0, 1);
    }
  }

  clearKeys() { this.direction = undefined; }

  sync(farm: FarmState, active: Bed | null, frame: FarmFrame, reducedMotion: boolean, autoplay = false, running = false, showcase = false, activeAnimal: string | null = null) {
    const avatarChanged = this.avatarKey !== JSON.stringify(farm.avatar);
    const reposition = this.frame?.columns !== frame.columns || this.farm?.farmDay.date !== farm.farmDay.date;
    const changed = this.activeAnimal !== activeAnimal || this.running !== running || this.active?.areaId !== active?.areaId || this.active?.tileId !== active?.tileId || reposition;
    this.farm = farm;
    this.active = active;
    this.frame = frame;
    this.reducedMotion = reducedMotion;
    this.autoplay = autoplay;
    this.showcase = showcase;
    this.running = running;
    this.activeAnimal = activeAnimal;
    if (avatarChanged) this.applyFarmerAppearance(farm.avatar);
    const availableAreas = active ? active.areaId + 1 : farm.progress.unlockedAreaCount;
    this.paths = farmPaths(availableAreas, frame, farm.progress.unlockedAnimals, SEASON_CONTENT[farm.progress.season].animals);
    if (reposition && this.farmer) {
      const origin = areaOrigin(active?.areaId ?? 0, frame.columns);
      this.farmer.setPosition(origin.x + 192, origin.y + 192);
    }
    if (changed) {
      this.direction = undefined;
      this.tending = false;
      this.route = [];
      if (running && activeAnimal && this.farmer) {
        const index = SEASON_CONTENT[farm.progress.season].animals.indexOf(activeAnimal);
        const origin = penOrigin(index, 4, frame);
        this.route = pathRoute(this.farmer, { x: origin.x + (frame.sidePens ? 96 : 192), y: origin.y + (frame.sidePens ? 192 : 320) }, this.paths);
      }
      if (running && active && this.farmer) {
        const origin = areaOrigin(active.areaId, frame.columns);
        this.route = pathRoute(this.farmer, { x: origin.x + 192, y: origin.y + 192 }, this.paths);
      }
    }
    if (this.ground) this.renderFarm();
  }

  private applyFarmerAppearance(appearance?: FarmerAppearance) {
    if (!this.farmer || !appearance) return;
    const key = JSON.stringify(appearance);
    if (key !== this.avatarKey) {
      const source = this.textures.get("farmer-sheet").getSourceImage() as HTMLImageElement;
      let texture = this.textures.exists("custom-farmer") ? this.textures.get("custom-farmer") : null;
      if (!texture) {
        const canvas = document.createElement("canvas");
        canvas.width = source.naturalWidth;
        canvas.height = source.naturalHeight;
        texture = this.textures.addCanvas("custom-farmer", canvas);
        for (let row = 0; row < 4; row++)
          for (let column = 0; column < 5; column++)
            texture!.add(row + "-" + column, 0, 95 + column * 242, 30 + row * 257, 240, 245);
      }
      const context = (texture as Phaser.Textures.CanvasTexture).getContext();
      context.clearRect(0, 0, source.naturalWidth, source.naturalHeight);
      context.drawImage(source, 0, 0);
      recolorFarmer(context, appearance);
      (texture as Phaser.Textures.CanvasTexture).refresh();
      this.avatarKey = key;
    }
    this.farmer.setTexture("custom-farmer", this.lastFarmerFrame || "0-0");
  }

  private renderFarm() {
    if (!this.ground || !this.plants || !this.farmer || !this.farm || !this.frame) return;
    const { columns, zoom, inset, topInset, width, height } = this.frame;
    this.scale.resize(width, height);
    const camera = this.cameras.main;
    camera.setZoom(zoom);
    camera.removeBounds();
    camera.setScroll((width * (1 - zoom) / 2 - inset) / zoom, (height * (1 - zoom) / 2 - topInset) / zoom);
    this.ground.clear();
    this.shade?.clear();
    this.spriteImages.forEach(image => image.destroy());
    this.spriteImages = [];
    this.cropImages = [];
    this.animalImages.forEach(({ sleepMark }) => sleepMark.destroy());
    this.animalImages = [];
    this.groundImages.forEach(image => image.destroy());
    this.groundImages = [];

    for (let areaId = 0; areaId < 4; areaId++) {
      const { x, y } = areaOrigin(areaId, columns);
      const leftGate = areaId % columns > 0 || !this.frame.sidePens && areaId === 0;
      const rightGate = areaId % columns + 1 < columns && areaId + 1 < 4
        || this.frame.sidePens && areaId % columns === columns - 1;
      const topGate = areaId >= columns || areaId === 0;
      const bottomGate = areaId + columns < 4 || areaId % columns === 0;
      this.groundImages.push(this.add.image(x + 12, y + 32, "sandy-path").setOrigin(0).setDisplaySize(360, 320).setTint(0xb9a17d).setDepth(-2));
      this.groundImages.push(this.add.image(x + 176, y + 32, "sandy-path").setOrigin(0).setDisplaySize(32, 320).setDepth(-1));
      this.groundImages.push(this.add.image(x + 12, y + 176, "sandy-path").setOrigin(0).setDisplaySize(360, 32).setDepth(-1));
      if (rightGate)
        this.groundImages.push(this.add.image(x + 352, y + 176, "sandy-path").setOrigin(0).setDisplaySize(96, 32).setDepth(-1));
      if (bottomGate)
        this.groundImages.push(this.add.image(x + 176, y + 352, "sandy-path").setOrigin(0).setDisplaySize(32, 96).setDepth(-1));
      this.drawFence(x, y, leftGate, rightGate, topGate, bottomGate, 20);

      BED_OFFSETS.forEach(([offsetX, offsetY], tileId) => {
        const bx = x + offsetX;
        const by = y + offsetY;
        const tile = this.farm!.farmDay.tiles.find(entry => entry.areaId === areaId && entry.tileId === tileId);
        this.spriteImages.push(this.add.image(bx, by, "raised-bed").setOrigin(0).setDisplaySize(BED_WIDTH, 124).setDepth(1));
        if (tile && this.textures.exists(`crop-${tile.cropId}`))
          for (const [plantX, plantY] of PLANT_OFFSETS) {
            const image = this.add.image(bx + plantX, by + plantY, `crop-${tile.cropId}`, "mature").setOrigin(0.5, 1).setDisplaySize(26, 26).setDepth(3);
            this.spriteImages.push(image);
            this.cropImages.push({ image, tile, index: areaId * 4 + tileId });
          }
      });
      if (!this.autoplay) {
        const lockedBeds = BED_OFFSETS.map((_, tileId) => bedState(this.farm!, areaId, tileId) === "locked");
        if (lockedBeds.every(Boolean)) this.shade?.fillStyle(0x17251e, .66).fillRect(x + 2, y + 22, 382, 342);
        else BED_OFFSETS.forEach(([bx, by], tileId) => {
          if (lockedBeds[tileId]) this.shade?.fillStyle(0x17251e, .62).fillRect(x + bx, y + by, BED_WIDTH, 124);
        });
        if (areaId >= this.farm.progress.unlockedAreaCount) this.drawAreaLock(x + 192, y + 192);
      }
    }

    SEASON_CONTENT[this.farm.progress.season].animals.forEach((animal, index) => {
      const unlocked = this.autoplay || this.farm!.progress.unlockedAnimals.includes(animal);
      const origin = penOrigin(index, 4, this.frame!);
      const season = this.farm!.progress.season;
      const penGround = season === "winter" ? "winter-ground" : season === "autumn" ? "autumn-ground" : season === "summer" ? "sandy-path" : "meadow-ground";
      this.groundImages.push(this.add.image(origin.x + 32, origin.y + 32, penGround).setOrigin(0).setDisplaySize(320, 320).setTint(0xa7b996).setDepth(-2));
      this.drawFence(origin.x, origin.y, this.frame!.sidePens, false, false, !this.frame!.sidePens);
      if (!this.frame!.sidePens) {
        this.groundImages.push(this.add.image(origin.x + 176, origin.y + 320, "sandy-path").setOrigin(0).setDisplaySize(32, 80).setDepth(-1));
        this.groundImages.push(this.add.image(-32, origin.y + 368, "sandy-path").setOrigin(0).setDisplaySize(origin.x + 240, 32).setDepth(-1));
      }
      if (this.frame!.sidePens)
        this.groundImages.push(this.add.image(origin.x, origin.y + 176, "sandy-path").setOrigin(0).setDisplaySize(96, 32).setDepth(-1));
      const count = animalPopulation(animal);
      this.drawShelter(origin.x, origin.y, ["chicken", "duck", "turkey"].includes(animal), count);
      const size = animal === "alpaca" ? 76 : count === 4 ? 56 : 80;
      const texture = this.textures.get(`animal-${animal}`);
      const extent = Math.max(...[0, 1, 2, 3].flatMap(pose => [texture.get(String(pose)).width, texture.get(String(pose)).height]));
      const scaleX = size / (animal in ANIMAL_SHEETS ? texture.get("0").width : extent);
      const scaleY = size / (animal in ANIMAL_SHEETS ? texture.get("0").height : extent);
      const positions = count === 4 ? [[112, 202], [262, 202], [132, 272], [272, 272]] : [[128, 234], [264, 244]];
      for (const [animalX, animalY] of positions) {
        const x = origin.x + animalX;
        const y = origin.y + animalY;
        const image = this.add.image(x, y, `animal-${animal}`, "0").setOrigin(0.5, 1).setScale(scaleX, scaleY).setDepth(5);
        const sleepMark = this.add.text(x + 18, y - size * .9, "Zz", { fontFamily: "monospace", fontSize: "16px", color: "#fff1b8", stroke: "#3a3027", strokeThickness: 3 }).setOrigin(.5, .5).setDepth(6);
        this.spriteImages.push(image);
        this.animalImages.push({ image, sleepMark, animalId: animal, x, y, unlocked, scaleX, scaleY });
      }
      if (!unlocked) {
        this.shade?.fillStyle(0x17251e, .66).fillRect(origin.x + 22, origin.y + 22, 342, 342);
        this.drawAreaLock(origin.x + 192, origin.y + 192);
      }
    });

    // Footpaths continue beyond the gardens into the surrounding meadow.
    const rows = Math.ceil(4 / columns);
    this.groundImages.push(this.add.image(176, -128, "sandy-path").setOrigin(0).setDisplaySize(32, 160).setDepth(-1));
    this.groundImages.push(this.add.image(176, rows * 416 - 68, "sandy-path").setOrigin(0).setDisplaySize(32, 200).setDepth(-1));
    if (this.frame.sidePens) {
      const lastPen = penOrigin(1, 4, this.frame);
      this.groundImages.push(this.add.image(lastPen.x, 176, "sandy-path").setOrigin(0).setDisplaySize(32, lastPen.y + 32).setDepth(-1));
    }
    if (!this.frame.sidePens) {
      const lastPen = penOrigin(1, 4, this.frame);
      this.groundImages.push(this.add.image(-32, 176, "sandy-path").setOrigin(0).setDisplaySize(80, 32).setDepth(-1));
      this.groundImages.push(this.add.image(-32, 176, "sandy-path").setOrigin(0).setDisplaySize(32, lastPen.y + 224).setDepth(-1));
    }
    this.drawMeadow();

    this.lastPlantFrame = -1;
    this.renderPlants(0);
    this.showFarmerFrame("0-0");
  }

  private drawShelter(x: number, y: number, chicken: boolean, count: number) {
    const g = this.ground!;
    g.fillStyle(0x354b2d, .25).fillEllipse(x + 180, y + 144, 180, 36);
    g.fillStyle(0x634533).fillRect(x + 103, y + 82, 144, 64);
    g.fillStyle(0xcb9d62).fillRect(x + 108, y + 84, 134, 54);
    for (let board = 0; board < 8; board++)
      g.fillStyle(0xa5794c).fillRect(x + 110 + board * 17, y + 84, 2, 54);
    g.fillStyle(0x46352b).fillRect(x + 162, y + 102, 28, 36);
    g.fillStyle(chicken ? 0x784539 : 0x486064).fillRect(x + 94, y + 62, 162, 28);
    for (let row = 0; row < 4; row++)
      g.fillStyle(chicken ? 0xb56547 : 0x6e8d87).fillRect(x + 98 + row * 3, y + 61 + row * 6, 154 - row * 6, 3);
    g.fillStyle(0xe5c889).fillRect(x + 157, y + 137, 38, 7);
    // Hay, a water trough, and one nesting/grooming spot per animal.
    g.fillStyle(0xb29245).fillRoundedRect(x + 66, y + 96, 27, 40, 3);
    g.fillStyle(0xe0c775).fillRect(x + 69, y + 100, 21, 3).fillRect(x + 69, y + 111, 21, 3);
    g.fillStyle(0x72533c).fillRect(x + 277, y + 99, 38, 24);
    g.fillStyle(0x78a9ad).fillRect(x + 281, y + 103, 30, 14);
    g.fillStyle(0xb6d9c6).fillRect(x + 284, y + 104, 15, 2);
    for (let i = 0; i < count; i++) {
      g.fillStyle(0x9b7a44).fillEllipse(x + 72 + (i + .5) * 240 / count, y + 305, 40, 18);
      g.fillStyle(0xd2b66d).fillEllipse(x + 72 + (i + .5) * 240 / count, y + 302, 32, 12);
    }
  }

  private drawAreaLock(x: number, y: number) {
    const g = this.shade!;
    g.fillStyle(0x342d22, .8).fillRoundedRect(x - 24, y - 4, 48, 40, 4);
    g.lineStyle(7, 0xf0d28c, 1).strokeCircle(x, y - 10, 13);
    g.fillStyle(0xf0d28c).fillRoundedRect(x - 23, y - 4, 46, 37, 5);
    g.fillStyle(0x705438).fillCircle(x, y + 12, 4).fillRect(x - 2, y + 14, 4, 9);
  }

  private drawMeadow() {
    const g = this.ground!;
    const worldWidth = (this.frame!.columns + Number(this.frame!.sidePens)) * 416 - 32;
    const worldHeight = this.frame!.rows * 416 - 32;
    // Deterministic scatter in the verges, leaving the beds and paths clear.
    for (let i = 0; i < 110; i++) {
      const x = ((i * 173 + 47) % (worldWidth + 160)) - 80;
      const y = ((i * 277 + 29) % (worldHeight + 160)) - 80;
      const localX = ((x % 416) + 416) % 416;
      const localY = ((y % 416) + 416) % 416;
      if (localX < 364 && localY < 364 || Math.abs(localX - 192) < 24 || Math.abs(localY - 192) < 24) continue;
      g.fillStyle(0x496a3d, .5).fillEllipse(x + 2, y + 4, 13, 5);
      g.fillStyle(i % 4 === 0 ? 0x99978a : 0x779348).fillRect(x - 3, y - 3, 9, 7);
      g.fillStyle(i % 4 === 0 ? 0xb9b6a1 : 0xdacb7d).fillRect(x - 2, y - 4, 4, 3);
    }
  }

  private drawFence(areaX: number, areaY: number, leftGate: boolean, rightGate: boolean, topGate: boolean, bottomGate: boolean, extension = 0) {
    const g = this.ground!;
    const horizontal = (from: number, to: number, y: number) => {
      if (from === 32) from -= extension;
      if (to === 352) to += extension;
      g.fillStyle(0x68472f).fillRect(areaX + from, areaY + y, to - from, 11);
      g.fillStyle(0xba8d58).fillRect(areaX + from, areaY + y + 1, to - from, 3).fillRect(areaX + from, areaY + y + 7, to - from, 3);
    };
    const vertical = (x: number, from: number, to: number) => {
      x += x === 28 ? -extension : extension;
      g.fillStyle(0x68472f).fillRect(areaX + x, areaY + from, 11, to - from);
      g.fillStyle(0xba8d58).fillRect(areaX + x + 1, areaY + from, 3, to - from).fillRect(areaX + x + 7, areaY + from, 3, to - from);
    };
    const post = (x: number, y: number) => {
      if (x === 32) x -= extension;
      if (x === 352) x += extension;
      g.fillStyle(0x5b3d2b).fillRect(areaX + x - 4, areaY + y - 5, 12, 17);
      g.fillStyle(0xc39862).fillRect(areaX + x - 5, areaY + y - 7, 11, 16);
      g.fillStyle(0xe2b879).fillRect(areaX + x - 4, areaY + y - 7, 7, 3);
    };
    if (topGate) { horizontal(32, 176, 28); horizontal(208, 352, 28); }
    else horizontal(32, 352, 28);
    if (bottomGate) { horizontal(32, 176, 348); horizontal(208, 352, 348); }
    else horizontal(32, 352, 348);
    if (leftGate) {
      vertical(28, 32, 176);
      vertical(28, 208, 352);
    } else vertical(28, 32, 352);
    if (rightGate) {
      vertical(348, 32, 176);
      vertical(348, 208, 352);
    } else vertical(348, 32, 352);
    for (let coordinate = 32; coordinate <= 352; coordinate += 32) {
      if (!topGate || coordinate <= 176 || coordinate >= 208) post(coordinate, 32);
      if (!bottomGate || coordinate <= 176 || coordinate >= 208) post(coordinate, 352);
      if (coordinate !== 32 && coordinate !== 352) {
        if (!leftGate || coordinate < 176 || coordinate > 208) post(32, coordinate);
        if (!rightGate || coordinate < 176 || coordinate > 208) post(352, coordinate);
      }
    }
    if (leftGate) { post(32, 176); post(32, 208); }
    if (rightGate) { post(352, 176); post(352, 208); }
    if (topGate) { post(176, 32); post(208, 32); }
    if (bottomGate) { post(176, 352); post(208, 352); }
  }

  private renderPlants(sway: number) {
    if (!this.plants || !this.farm) return;
    this.plants.clear();
    this.cropImages.forEach(({ image, tile, index }) => {
      const state = this.autoplay && !this.showcase ? previewGrowth(this.elapsed / 1000, index) : tile;
      const stage = growthStage({ ...tile, ...state });
      image.setVisible(this.autoplay && !this.showcase ? !state.harvested && stage > 0 : stage >= 3);
      const size = this.autoplay && !this.showcase ? 8 + stage * 6 : 26;
      const animated = this.autoplay || this.running && bedState(this.farm!, tile.areaId, tile.tileId) === "active";
      if (tile.cropId in CROP_SHEETS) image.setDisplaySize(size, size);
      else image.setScale(size / Math.max(image.frame.width, image.frame.height));
      image.setAngle(this.reducedMotion || !animated ? 0 : sway * 2 - 1);
      image.setTint(stage < 2 ? 0x9ca85a : 0xffffff);
    });
    for (const source of this.farm.farmDay.tiles) {
      const tile = this.autoplay && !this.showcase ? { ...source, ...previewGrowth(this.elapsed / 1000, source.areaId * 4 + source.tileId) } : source;
      if (this.autoplay && growthStage(tile) > 0) continue;
      if (tile.harvested || growthStage(tile) >= 3 && this.textures.exists(`crop-${tile.cropId}`)) continue;
      const [offsetX, offsetY] = BED_OFFSETS[tile.tileId];
      const origin = areaOrigin(tile.areaId, this.frame!.columns);
      for (const [plantX, plantY] of PLANT_OFFSETS)
        this.drawCrop(this.plants, origin.x + offsetX + plantX, origin.y + offsetY + plantY, tile, this.autoplay || this.running && bedState(this.farm, tile.areaId, tile.tileId) === "active" ? sway : 0);
    }
  }

  private renderProduce() {
    const g = this.produce!;
    g.clear();
    if (!this.farm || !this.frame) return;
    this.farm.progress.unlockedAnimals.forEach((animal, index) => {
      const product = ANIMAL_PRODUCTS[animal];
      if (!product) return;
      const origin = penOrigin(index, this.farm!.progress.unlockedAreaCount, this.frame!);
      const count = this.showcase ? 4 : this.autoplay ? previewProduce(this.elapsed / 1000, index) : Math.min(4, this.farm!.inventory[`animal:${animal}`] ?? 0);
      const population = animalPopulation(animal);
      const perAnimal = 4 / population;
      for (let i = 0; i < count; i++) {
        const spot = Math.floor(i / perAnimal);
        const x = origin.x + 72 + (spot + .5) * 240 / population + (perAnimal === 2 ? (i % 2 === 0 ? -8 : 8) : 0);
        const y = origin.y + 298;
        g.fillStyle(0x765d3c, .3).fillEllipse(x + 2, y + 6, 22, 8);
        if (product === "egg") {
          g.fillStyle(0xd7c7a4).fillEllipse(x + 1, y, 13, 17);
          g.fillStyle(0xfff2cf).fillEllipse(x - 1, y - 2, 10, 13);
          g.fillStyle(0xffffff).fillRect(x - 3, y - 6, 3, 4);
        } else if (product === "milk") {
          g.fillStyle(0x526775).fillRoundedRect(x - 7, y - 13, 14, 22, 3);
          g.fillStyle(0xb9ced3).fillRect(x - 5, y - 10, 10, 17);
          g.fillStyle(0xeef5e6).fillRect(x - 4, y - 7, 8, 10);
          g.fillStyle(0x819aa3).fillRect(x - 5, y - 16, 10, 4);
          g.fillStyle(0xffffff).fillRect(x - 3, y - 9, 2, 14);
        } else {
          g.fillStyle(0xc4bdaa).fillRoundedRect(x - 12, y - 8, 24, 18, 5);
          g.fillStyle(0xf0e9d7).fillCircle(x - 7, y - 6, 7).fillCircle(x + 6, y - 6, 8).fillCircle(x, y - 10, 7);
          g.fillStyle(0xb09362).fillRect(x - 2, y - 14, 3, 24);
        }
      }
    });
    if (this.showcase || !this.autoplay) return;
    for (const tile of this.farm.farmDay.tiles) {
      if (!previewGrowth(this.elapsed / 1000, tile.areaId * 4 + tile.tileId).harvested) continue;
      const origin = areaOrigin(tile.areaId, this.frame.columns);
      const x = origin.x + 180, y = origin.y + 180;
      g.fillStyle(0x795033).fillRect(x, y, 24, 18);
      g.fillStyle(0xc79b60).fillRect(x + 2, y + 4, 20, 3).fillRect(x + 2, y + 12, 20, 3);
      g.fillStyle(tile.cropId === "peas" ? 0x8eae53 : 0xd86f61).fillCircle(x + 7, y + 1, 5).fillCircle(x + 16, y, 5);
    }
  }

  private drawCrop(graphics: Phaser.GameObjects.Graphics, x: number, y: number, tile: FarmTile, sway: number) {
    const stage = growthStage(tile);
    if (stage === 0) {
      graphics.fillStyle(0x4f8a42).fillRect(x - 2, y - 3, 4, 3);
      return;
    }
    const height = 5 + stage * 8;
    graphics.fillStyle(0x46352b, 0.35).fillEllipse(x + 3, y + 1, 18, 5);
    graphics.fillStyle(0x2f6b38).fillRect(x - 2, y - height, 4, height);
    graphics.fillStyle(0x427f43).fillEllipse(x - 7 + sway, y - height + 7, 11 + stage / 2, 6);
    graphics.fillStyle(0x68a455).fillEllipse(x + 7 + sway, y - height + 11, 11 + stage / 2, 6);
    graphics.fillStyle(0x9cc46b).fillRect(x - 10 + sway, y - height + 5, 4, 1);
    if (stage >= 2) {
      const fruitColor = tile.cropId === "peas" ? 0x9bbf54 : tile.cropId === "radish" ? 0xbd4354 : 0xd9564e;
      graphics.fillStyle(fruitColor);
      graphics.fillCircle(x - 6 + sway, y - height + 10, 3 + stage / 4);
      graphics.fillCircle(x + 7 + sway, y - height + 14, 3 + stage / 4);
    }
  }

  private showFarmerFrame(frame: string) {
    if (this.farmer && this.lastFarmerFrame !== frame) {
      this.farmer.setFrame(frame);
      this.farmer.setDisplaySize(64, 64);
      this.lastFarmerFrame = frame;
    }
  }

  update(time: number, delta: number) {
    if (!this.farmer || !this.frame) return;
    this.elapsed += delta;
    let walk = { x: this.farmer.x, y: this.farmer.y, facing: "down" as Direction, walking: false };
    if (this.autoplay) {
      if (!this.reducedMotion) walk = previewFarmer(this.elapsed, this.frame.columns);
    } else {
      if (!this.running && this.direction && this.route.length === 0) {
        const nearest = nearestPath(this.farmer, this.paths);
        if (Math.hypot(nearest.x - this.farmer.x, nearest.y - this.farmer.y) > .1) this.route = [nearest];
        else {
          const next = pathStep(nearest, this.direction, this.paths);
          if (next) this.route = [next];
        }
      }
      if (this.route.length) walk = advancePath(this.farmer, this.route, Math.min(delta, 50) * .09);
      else if (this.running && this.activeAnimal) {
        if (!this.tending) { this.tending = true; this.walkStart = time; }
        const index = SEASON_CONTENT[this.farm!.progress.season].animals.indexOf(this.activeAnimal);
        const origin = penOrigin(index, 4, this.frame);
        const target = nearestPath({ x: origin.x + (this.frame.sidePens ? 96 : 192), y: origin.y + (this.frame.sidePens ? 192 : 320) }, this.paths);
        walk = { x: target.x, y: target.y, facing: this.frame.sidePens ? "right" : "up", walking: false };
      }
      else if (this.running && this.active) {
        if (!this.tending) { this.tending = true; this.walkStart = time; }
        if (!this.reducedMotion) walk = farmerPosition(time - this.walkStart, this.active.areaId, this.active.tileId, this.frame.columns);
      }
    }
    this.farmer.setPosition(walk.x, walk.y);
    const row = { down: 0, left: 1, right: 2, up: 3 }[walk.facing];
    this.showFarmerFrame(`${row}-${walk.walking && !this.reducedMotion ? 1 + Math.floor(time / 130) % 4 : 0}`);
    this.farmerShadow?.clear().fillStyle(0x4c603b, 0.4).fillEllipse(walk.x, walk.y + 1, 26, 6);
    this.animalImages.forEach(({ image, sleepMark, animalId, x, y, unlocked, scaleX, scaleY }, index) => {
      const working = this.autoplay || this.running && this.activeAnimal === animalId;
      const still = this.reducedMotion || !working;
      const restingFrame = animalId in ANIMAL_SHEETS ? 2 : 3;
      sleepMark.setVisible(unlocked && !working && !this.autoplay);
      sleepMark.setPosition(x + 18, y - Math.max(32, image.displayHeight) * .9);
      image.setFrame(String(still ? restingFrame : Math.floor(time / 350 + index) % 4));
      image.setScale(scaleX, scaleY);
      image.setPosition(x + (still ? 0 : Math.round(Math.sin(time / 2300 + index * 2) * 22)), y + (still ? 0 : Math.round(Math.sin(time / 3100 + index) * 18)));
      image.setFlipX(!still && Math.cos(time / 2300 + index * 2) < 0);
    });
    if (this.butterfly && this.frame) {
      this.butterfly.setVisible(this.autoplay);
      const flutter = this.reducedMotion ? 0 : time / 450;
      const bx = 338 + Math.round(Math.sin(flutter) * 5);
      const by = 176 + Math.round(Math.sin(flutter * 1.3) * 4);
      const wing = this.reducedMotion ? 3 : 2 + Math.round(Math.abs(Math.sin(flutter * 3)) * 2);
      this.butterfly.clear().fillStyle(0xf0d47c).fillRect(bx - wing - 1, by, wing, 3).fillRect(bx + 1, by, wing, 3);
      this.butterfly.fillStyle(0x614e38).fillRect(bx, by, 1, 4);
    }
    const plantFrame = Math.floor(time / 350);
    if (plantFrame !== this.lastPlantFrame) {
      this.renderPlants(this.reducedMotion ? 0 : plantFrame % 2);
      this.renderProduce();
      this.lastPlantFrame = plantFrame;
    }
  }
}
