/**
 * imports: externals
 */

import Logger from "@sha3/logger";
import Browser from "@sha3/crawler";
import sharp from "sharp";
import * as path from "path";
import * as fs from "fs";

/**
 * imports: internals
 */

import NotionBlockCollection from "./notion-block-collection";
import NotionBlock from "./notion-block";

/**
 * module: initializations
 */

const logger = new Logger("notion");

/**
 * types
 */

export type FetchOptions = {
  coverImageHeight: number;
  bodyMaxWidth: number;
  viewBlockBackgroundColor: string;
};

export type FetchResult = {
  url: string;
  title?: string;
  coverImage?: Buffer;
  icon?: Buffer;
  emojis?: Record<string, Buffer>;
  blocks: NotionBlock[];
  allBlocks: NotionBlock[];
};

export type LoadOptions = {
  url: string;
};

export type Tab = Awaited<ReturnType<Browser["open"]>>;

/**
 * consts
 */

const DEFAULT_BROWSER_TIMEOUT = 30000;
const DESKTOP_VIEWPORT = { width: 910, height: 900 };
const MOBILE_VIEWPORT = { width: 600, height: 960 };
const INIT_STYLES = fs.readFileSync(path.join(__dirname, "/fetch/init.css")).toString();
const NO_BACKGROUND_STYLES = fs.readFileSync(path.join(__dirname, "/fetch/no-background.css")).toString();
const IMAGE_DISPLAY_NONE_STYLES = fs.readFileSync(path.join(__dirname, "/fetch/image-display-none.css")).toString();

/**
 * export
 */

export default class Fetch {
  /**
   * private: attributes
   */

  private browser: Browser;

  /**
   * private: methods
   */

  private async getScrollerOffsetHeight(tab: Tab) {
    return (await tab.exec((window: Window) =>
      window.document.querySelector(".notion-scroller.vertical")
        ? window.document.querySelector<HTMLDivElement>(".notion-scroller.vertical").offsetHeight
        : null
    )) as number;
  }

  private async getVerticalScroll(tab: Tab) {
    return (await tab.exec((window: Window) =>
      window.document.querySelector(".notion-scroller.vertical") &&
      window.document.querySelector(".notion-scroller.vertical").scrollHeight
        ? (window.document.querySelector(".notion-scroller.vertical").scrollTop +
            window.document.querySelector<HTMLDivElement>(".notion-scroller.vertical").offsetHeight) /
          window.document.querySelector(".notion-scroller.vertical").scrollHeight
        : null
    )) as number;
  }

  private async forceLoadScrolling(tab: Tab) {
    await tab.wait({
      functionToExec: (window: Window) => window.document.querySelector(".notion-page-content"),
      timeout: DEFAULT_BROWSER_TIMEOUT,
    });

    let scrollPerc = await this.getVerticalScroll(tab);
    const scrollerHeight = await this.getScrollerOffsetHeight(tab);
    if (scrollPerc !== null) {
      while (scrollPerc < 0.9) {
        await tab.evaluate(`document.querySelector('.notion-scroller.vertical').scrollTop += ${scrollerHeight}`);
        scrollPerc = await this.getVerticalScroll(tab);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    await tab.wait({
      functionToExec: (window: Window) => !window.document.querySelector(".loading-spinner"),
      timeout: DEFAULT_BROWSER_TIMEOUT,
    });
  }

  private async removeTopbar(tab: Tab) {
    await tab.exec((window: Window) => {
      window.document.querySelector(".notion-topbar").remove();
    });
  }

  private async extractIcon(tab: Tab) {
    const iconSelector = `main .notion-record-icon img, main .notion-record-icon [role='img']`;
    const iconBuffer = await tab.getImage(iconSelector, { trim: true });
    await tab.evaluate((iconSelector: string) => {
      window.document.querySelector<HTMLImageElement>(iconSelector).style.display = "none";
    }, iconSelector);
    return iconBuffer;
  }

  private async listEmojis(tab: Tab) {
    const heights: Record<string, number> = {};
    const result: Record<string, Buffer> = {};
    const emojiSelector = `[data-block-id] span[role="img"][aria-label]`;
    const elems = await tab.querySelectorAll<HTMLElement>(emojiSelector);
    for (const elem of elems) {
      const ariaLabelProperty = await elem.getProperty("ariaLabel");
      const ariaLabel = (await ariaLabelProperty.jsonValue())?.trim();
      if (ariaLabel) {
        const offsetHeightProperty = await elem.getProperty("offsetHeight");
        const offsetHeight = await offsetHeightProperty.jsonValue();
        const offsetWidthProperty = await elem.getProperty("offsetWidth");
        const offsetWidth = await offsetWidthProperty.jsonValue();
        if (offsetHeight > offsetWidth) {
          await elem.evaluate((elem) => (elem.style.paddingRight = `${elem.offsetHeight - elem.offsetWidth}px`));
        }
        if (!result[ariaLabel] || heights[ariaLabel] < offsetHeight) {
          heights[ariaLabel] = offsetHeight;
          const buffer = await elem.screenshot({ omitBackground: true });
          const sharpInstance = sharp(buffer).trim();
          result[ariaLabel] = await sharpInstance.toBuffer();
        }
      }
    }
    return result;
  }

  private async getCoverImage(tab: Tab, options: { iconBuffer?: Buffer } = {}) {
    const { bodyMaxWidth: width, coverImageHeight: height } = this.options;
    const { iconBuffer } = options;
    let coverImageBuffer = await tab.getImage("main .layout-full img");
    if (coverImageBuffer) {
      coverImageBuffer = await sharp(coverImageBuffer).resize({ width, height }).toBuffer();
      if (iconBuffer) {
        const iconMetadata = await sharp(iconBuffer).metadata();
        const incHeight = iconMetadata.height / 2;
        coverImageBuffer = await sharp(coverImageBuffer)
          .extend({
            bottom: parseInt(incHeight.toString()),
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .composite([
            {
              input: iconBuffer,
              top: parseInt((height - incHeight).toString()),
              left: 10,
            },
          ])
          .sharpen()
          .toBuffer();
      }
    }
    return coverImageBuffer;
  }

  private getTitle(dom: Document) {
    return dom.querySelector<HTMLTitleElement>("title")?.innerHTML;
  }

  private async getBlockCollection(options: { tab: Tab; dom: Document }) {
    const { tab, dom } = options;
    const { viewBlockBackgroundColor } = this.options;
    const processCollectionOptions = { viewBlockBackgroundColor };
    const blockCollection = new NotionBlockCollection(tab);
    const blocksSelector = `.notion-page-content > [data-block-id]`;
    const blocksNodes = Array.from(dom.querySelectorAll<HTMLDivElement>(blocksSelector));
    blocksNodes.forEach((node) => blockCollection.addBlock(node));
    logger.debug(`processing ${blocksNodes.length} blocks`);
    const noBackgroundStyleElem = await tab.addStyle(NO_BACKGROUND_STYLES);
    await blockCollection.processBlockImages();
    await noBackgroundStyleElem.evaluate((elem) => elem.parentNode.removeChild(elem));
    await blockCollection.processBlockCollection(processCollectionOptions);
    if (blockCollection.HasScreenshots) {
      logger.debug(`processing ${blocksNodes.length} blocks (mobile)`);
      await tab.setViewport(MOBILE_VIEWPORT, { waitInMs: 5000 });
      await blockCollection.processBlockCollectionForMobile(processCollectionOptions);
    }
    return blockCollection;
  }

  /**
   * constructor
   */

  constructor(private options: FetchOptions) {
    this.browser = new Browser();
  }

  /**
   * public : methods
   */

  public async loadFromPublicUrl(options: LoadOptions) {
    let tab: Tab;
    const { url } = options;
    logger.debug(`loading url ${url}`);
    tab = await this.browser.open(url, { viewport: DESKTOP_VIEWPORT, style: INIT_STYLES, headless: false });
    await this.forceLoadScrolling(tab);
    await this.removeTopbar(tab);
    const cssToApply = `${NO_BACKGROUND_STYLES}${IMAGE_DISPLAY_NONE_STYLES}`;
    const css = await tab.addStyle(cssToApply);
    const result: FetchResult = { url, blocks: [], allBlocks: [] };
    const dom = await tab.toDOM();
    result.title = this.getTitle(dom);
    result.icon = await this.extractIcon(tab);
    result.emojis = await this.listEmojis(tab);
    await css.evaluate((elem) => elem.parentNode.removeChild(elem));
    result.coverImage = await this.getCoverImage(tab, { iconBuffer: result.icon });
    const blockCollection = await this.getBlockCollection({ tab, dom });
    result.blocks = blockCollection.Blocks;
    result.allBlocks = blockCollection.AllBlocks;
    await tab.close();
    return result;
  }
}
