/**
 * imports: externals
 */

import Browser from "@sha3/crawler";

/**
 * imports: internals
 */

import NotionBlock from "./notion-block";

/**
 * module: initializations
 */

/**
 * types
 */

export type Tab = Awaited<ReturnType<Browser["open"]>>;

export type ProcessBlockCollectionOptions = { viewBlockBackgroundColor?: string };

/**
 * consts
 */

/**
 * export
 */

export default class NotionBlockCollection {
  /**
   * private: attributes
   */

  private blocks: NotionBlock[] = [];

  private allBlocks: NotionBlock[] = [];

  /**
   * private: methods
   */

  /**
   * constructor
   */
  constructor(private tab: Tab) {}

  /**
   * public: properties
   */

  public get HasScreenshots() {
    return !!this.allBlocks.find((i) => i.ScreenshotSelector);
  }

  public get Blocks() {
    return this.blocks;
  }

  public get AllBlocks() {
    return this.allBlocks;
  }
  /**
   * public: methods
   */

  public addBlock(node: HTMLDivElement) {
    const block = new NotionBlock(node);
    this.blocks.push(block);
    if (block.Columns.length) {
      block.Columns.forEach((column) => this.allBlocks.push(...column.blocks));
    } else {
      this.allBlocks.push(block);
    }
  }

  public async processBlockImages() {
    for (const block of this.allBlocks) {
      if (block.ImageSelector) {
        const buffer = await this.tab.getImage(block.ImageSelector);
        block.setImageBuffer(buffer);
      }
    }
  }

  public async processBlockCollection(options: ProcessBlockCollectionOptions) {
    const { viewBlockBackgroundColor: background } = options;
    for (const block of this.allBlocks) {
      if (block.ScreenshotSelector) {
        const buffer = await this.tab.getImage(block.ScreenshotSelector, { trim: true, background });
        block.setScreenshotBuffer(buffer);
      }
    }
  }

  public async processBlockCollectionForMobile(options: ProcessBlockCollectionOptions) {
    const { viewBlockBackgroundColor: background } = options;
    for (const block of this.allBlocks) {
      if (block.ScreenshotSelector) {
        const buffer = await this.tab.getImage(block.ScreenshotSelector, { trim: true, background });
        block.setMobileScreenshotBuffer(buffer);
      }
    }
  }
}
