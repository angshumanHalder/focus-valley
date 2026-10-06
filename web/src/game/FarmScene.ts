import Phaser from "phaser";
import { growthStage } from "./farm.ts";
import { farmerPosition } from "./farmWalk.ts";
import { areaOrigin, frameAreas } from "./sceneLayout.ts";
import farmerSheet from "../../../art/source/farmer-sample.png?url";
import raisedBed from "../../../art/source/raised-bed-sample.png?url";
import sandyPath from "../../../art/source/sandy-path-sample.png?url";
import meadowGround from "../../../art/source/meadow-ground.png?url";
import strawberry from "../../../art/source/strawberry-growth-sample.png?url";
import peas from "../../../art/source/peas-growth-sample.png?url";
import radish from "../../../art/source/radish-growth-sample.png?url";
import tulip from "../../../art/source/tulip-growth-sample.png?url";
import chicken from "../../../art/source/chicken-sample.png?url";
import rabbit from "../../../art/source/rabbit-sample.png?url";

export type Bed = { areaId: number; tileId: number };
export type FarmFrame = ReturnType<typeof frameAreas>;

const BED_OFFSETS = [[44, 44], [216, 44], [44, 216], [216, 216]] as const;
const PLANT_OFFSETS = Array.from({ length: 16 }, (_, index) => [20 + index % 4 * 28, 32 + Math.floor(index / 4) * 25] as const);
const CROP_SHEETS = { strawberry, peas, radish, tulip };
const ANIMAL_SHEETS = { chicken, rabbit };

export class FarmScene extends Phaser.Scene {
  private ground?: Phaser.GameObjects.Graphics;
  private plants?: Phaser.GameObjects.Graphics;
  private farmerShadow?: Phaser.GameObjects.Graphics;
  private farmer?: Phaser.GameObjects.Image;
  private butterfly?: Phaser.GameObjects.Graphics;
  private spriteImages: Phaser.GameObjects.Image[] = [];
  private animalImages: { image: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  private groundImages: Phaser.GameObjects.Image[] = [];
  private farm?: FarmState;
  private active?: Bed | null;
  private frame?: FarmFrame;
  private reducedMotion = false;
  private walkStart = 0;
  private lastPlantFrame = -1;
  private lastFarmerFrame = "";

  constructor() {
    super("FarmScene");
  }

  preload() {
    this.load.image("farmer-sheet", farmerSheet);
    this.load.image("raised-bed", raisedBed);
    this.load.image("sandy-path", sandyPath);
    this.load.image("meadow-ground", meadowGround);
    for (const [crop, url] of Object.entries(CROP_SHEETS)) this.load.image(`crop-${crop}`, url);
    for (const [animal, url] of Object.entries(ANIMAL_SHEETS)) this.load.image(`animal-${animal}`, url);
  }

  create() {
    const sheet = this.textures.get("farmer-sheet");
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 5; column++)
        sheet.add(`${row}-${column}`, 0, 95 + column * 242, 30 + row * 257, 240, 245);
    for (const crop of Object.keys(CROP_SHEETS))
      this.textures.get(`crop-${crop}`).add("mature", 0, 1382, 500, 276, 320);
    for (const animal of Object.keys(ANIMAL_SHEETS))
      for (let frame = 0; frame < 4; frame++)
        this.textures.get(`animal-${animal}`).add(String(frame), 0, frame * 543, 0, 543, 724);
    this.ground = this.add.graphics().setDepth(0);
    this.plants = this.add.graphics().setDepth(3);
    this.farmerShadow = this.add.graphics().setDepth(4);
    this.farmer = this.add.image(192, 192, "farmer-sheet", "0-0").setOrigin(0.5, 1).setDisplaySize(64, 64).setDepth(5);
    this.butterfly = this.add.graphics().setDepth(6);
    this.renderFarm();
  }

  sync(farm: FarmState, active: Bed | null, frame: FarmFrame, reducedMotion: boolean) {
    if (this.active?.areaId !== active?.areaId || this.active?.tileId !== active?.tileId)
      this.walkStart = this.time?.now ?? 0;
    this.farm = farm;
    this.active = active;
    this.frame = frame;
    this.reducedMotion = reducedMotion;
    if (this.ground) this.renderFarm();
  }

  private renderFarm() {
    if (!this.ground || !this.plants || !this.farmer || !this.farm || !this.frame) return;
    const { columns, zoom, width, height } = this.frame;
    this.scale.resize(width, height);
    const camera = this.cameras.main;
    camera.setZoom(zoom);
    camera.setBounds(0, 0, width / zoom, height / zoom);
    camera.setScroll(0, 0);
    this.ground.clear();
    this.spriteImages.forEach(image => image.destroy());
    this.spriteImages = [];
    this.animalImages = [];
    this.groundImages.forEach(image => image.destroy());
    this.groundImages = [];

    for (let areaId = 0; areaId < this.farm.progress.unlockedAreaCount; areaId++) {
      const { x, y } = areaOrigin(areaId, columns);
      const leftGate = areaId % columns > 0;
      const rightGate = areaId % columns + 1 < columns && areaId + 1 < this.farm.progress.unlockedAreaCount;
      const topGate = areaId >= columns;
      const bottomGate = areaId + columns < this.farm.progress.unlockedAreaCount;
      this.groundImages.push(this.add.image(x + 32, y + 32, "sandy-path").setOrigin(0).setDisplaySize(320, 320).setTint(0xb9a17d).setDepth(-2));
      this.groundImages.push(this.add.image(x + 176, y + 32, "sandy-path").setOrigin(0).setDisplaySize(32, 320).setDepth(-1));
      this.groundImages.push(this.add.image(x + 32, y + 176, "sandy-path").setOrigin(0).setDisplaySize(320, 32).setDepth(-1));
      if (rightGate)
        this.groundImages.push(this.add.image(x + 352, y + 176, "sandy-path").setOrigin(0).setDisplaySize(96, 32).setDepth(-1));
      if (bottomGate)
        this.groundImages.push(this.add.image(x + 176, y + 352, "sandy-path").setOrigin(0).setDisplaySize(32, 96).setDepth(-1));
      this.drawFence(x, y, leftGate, rightGate, topGate, bottomGate);

      BED_OFFSETS.forEach(([offsetX, offsetY], tileId) => {
        const bx = x + offsetX;
        const by = y + offsetY;
        const tile = this.farm!.farmDay.tiles.find(entry => entry.areaId === areaId && entry.tileId === tileId);
        this.spriteImages.push(this.add.image(bx, by, "raised-bed").setOrigin(0).setDisplaySize(124, 124).setDepth(1));
        if (tile && !tile.harvested && growthStage(tile) >= 11 && this.textures.exists(`crop-${tile.cropId}`))
          for (const [plantX, plantY] of PLANT_OFFSETS)
            this.spriteImages.push(this.add.image(bx + plantX, by + plantY, `crop-${tile.cropId}`, "mature").setOrigin(0.5, 1).setDisplaySize(26, 26).setDepth(3));
      });
    }

    this.farm.progress.unlockedAnimals.filter(animal => this.textures.exists(`animal-${animal}`)).forEach((animal, index) => {
      const origin = areaOrigin(this.farm!.progress.unlockedAreaCount + index, columns);
      this.groundImages.push(this.add.image(origin.x + 32, origin.y + 32, "meadow-ground").setOrigin(0).setDisplaySize(320, 320).setTint(0xa7b996).setDepth(-2));
      this.drawFence(origin.x, origin.y, false, false, false, false);
      for (const [animalX, animalY] of [[112, 216], [192, 264], [272, 204]]) {
        const x = origin.x + animalX;
        const y = origin.y + animalY;
        const image = this.add.image(x, y, `animal-${animal}`, "0").setOrigin(0.5, 1).setDisplaySize(56, 56).setDepth(5);
        this.spriteImages.push(image);
        this.animalImages.push({ image, x, y });
      }
    });

    const origin = areaOrigin(this.active?.areaId ?? 0, columns);
    this.farmer.setPosition(origin.x + 192, origin.y + 192);
    this.lastPlantFrame = -1;
    this.renderPlants(0);
    this.showFarmerFrame("0-0");
  }

  private drawFence(areaX: number, areaY: number, leftGate: boolean, rightGate: boolean, topGate: boolean, bottomGate: boolean) {
    const g = this.ground!;
    const horizontal = (from: number, to: number, y: number) => {
      g.fillStyle(0x68472f).fillRect(areaX + from, areaY + y, to - from, 11);
      g.fillStyle(0xba8d58).fillRect(areaX + from, areaY + y + 1, to - from, 3).fillRect(areaX + from, areaY + y + 7, to - from, 3);
    };
    const vertical = (x: number, from: number, to: number) => {
      g.fillStyle(0x68472f).fillRect(areaX + x, areaY + from, 11, to - from);
      g.fillStyle(0xba8d58).fillRect(areaX + x + 1, areaY + from, 3, to - from).fillRect(areaX + x + 7, areaY + from, 3, to - from);
    };
    const post = (x: number, y: number) => {
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
    for (const tile of this.farm.farmDay.tiles) {
      if (tile.harvested || growthStage(tile) >= 11 && this.textures.exists(`crop-${tile.cropId}`)) continue;
      const [offsetX, offsetY] = BED_OFFSETS[tile.tileId];
      const origin = areaOrigin(tile.areaId, this.frame!.columns);
      for (const [plantX, plantY] of PLANT_OFFSETS)
        this.drawCrop(this.plants, origin.x + offsetX + plantX, origin.y + offsetY + plantY, tile, sway);
    }
  }

  private drawCrop(graphics: Phaser.GameObjects.Graphics, x: number, y: number, tile: FarmTile, sway: number) {
    const stage = growthStage(tile);
    if (stage === 0) {
      graphics.fillStyle(0x4f8a42).fillRect(x - 2, y - 3, 4, 3);
      return;
    }
    const height = 5 + stage * 2;
    graphics.fillStyle(0x46352b, 0.35).fillEllipse(x + 3, y + 1, 18, 5);
    graphics.fillStyle(0x2f6b38).fillRect(x - 2, y - height, 4, height);
    graphics.fillStyle(0x427f43).fillEllipse(x - 7 + sway, y - height + 7, 11 + stage / 2, 6);
    graphics.fillStyle(0x68a455).fillEllipse(x + 7 + sway, y - height + 11, 11 + stage / 2, 6);
    graphics.fillStyle(0x9cc46b).fillRect(x - 10 + sway, y - height + 5, 4, 1);
    if (stage >= 8) {
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

  update(time: number) {
    if (!this.farmer || !this.frame) return;
    const areaId = this.active?.areaId ?? 0;
    const origin = areaOrigin(areaId, this.frame.columns);
    const walk = this.reducedMotion || !this.active
      ? { x: origin.x + 192, y: origin.y + 192, facing: "down" as const, walking: false }
      : farmerPosition(time - this.walkStart, areaId, this.active.tileId, this.frame.columns);
    this.farmer.setPosition(walk.x, walk.y);
    const row = { down: 0, left: 1, right: 2, up: 3 }[walk.facing];
    this.showFarmerFrame(`${row}-${walk.walking ? 1 + Math.floor(time / 130) % 4 : 0}`);
    this.farmerShadow?.clear().fillStyle(0x4c603b, 0.4).fillEllipse(walk.x, walk.y + 1, 26, 6);
    this.animalImages.forEach(({ image, x, y }, index) => {
      image.setFrame(String(this.reducedMotion ? 0 : Math.floor(time / 350 + index) % 4)).setDisplaySize(56, 56);
      image.setPosition(x + (this.reducedMotion ? 0 : Math.round(Math.sin(time / 600 + index) * 12)), y);
    });
    if (this.butterfly && this.frame) {
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
      this.lastPlantFrame = plantFrame;
    }
  }
}
