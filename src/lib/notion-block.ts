/**
 * imports: externals
 */

/**
 * imports: internals
 */

import { NotionBlockText } from "../../dist/lib/utils.mjs";
import Utils from "./utils";

/**
 * module: initializations
 */

/**
 * types
 */

export type BlockType =
  | "unsupported"
  | "column"
  | "column-list"
  | "text"
  | "to-do"
  | "header-1"
  | "header-2"
  | "header-3"
  | "bulleted-list"
  | "numbered-list"
  | "quote"
  | "divider"
  | "callout"
  | "image"
  | "code"
  | "alias"
  | "view"
  | "embed";

/* export type NotionBlockData = {
  id: string;
  type: BlockType;
  node: HTMLElement;
  classList: string[];
  texts?: BlockText[];
  image?: string;
  columns?: NotionColumnData[] | null;
  title?: string | null;
  isColumnChild?: boolean;
  screenshot?: string;
  attributes: {
    checked?: boolean;
    listNumber?: number;
  };
}; */

export type NotionColumn = {
  width?: number;
  blocks: NotionBlock[];
};

export type BlockText = {
  className?: string;
  attributes?: Record<string, unknown>;
  style?: Record<string, string>;
  plainText?: string;
  href?: string;
  emoji?: string;
};

/**
 * consts
 */

/**
 * export
 */

export default class NotionBlock {
  /**
   * private: attributes
   */

  private id: string;
  private title: string;
  private className: string;
  private classList: string[];
  private type: string;
  private columns: NotionColumn[];
  private texts: NotionBlockText[];
  private imageSelector: string;
  private imageBuffer: Buffer;
  private attributes: Record<string, string | boolean> = {};
  private screenshotSelector: string;
  private screenshotBuffer: Buffer;
  private mobileScreenshotBuffer: Buffer;

  /**
   * private: methods
   */

  private getColumns() {
    const columnsNodes = Array.from(this.node.querySelectorAll(".notion-column-block"));
    const columns = columnsNodes.map((column) => {
      const notionColumn: NotionColumn = { blocks: [] };
      const parent = column.parentElement;
      const styles = Utils.getStylesFromNode(parent);
      if (styles.width) {
        const regexpResult = /calc\(\(100% - [0-9]+px\) \* (?<width>[0-9.]+)\)/.exec(styles.width);
        if (regexpResult?.groups?.width) {
          notionColumn.width = parseFloat(regexpResult.groups.width);
        }
      }
      const children = Array.from(column.querySelectorAll<HTMLDivElement>(":scope > [data-block-id]"));
      children.forEach((node) => {
        const columnNode = new NotionBlock(node, true);
        notionColumn.blocks.push(columnNode);
      });
      return notionColumn;
    });
    return columns;
  }

  private getListNumber(node: HTMLElement) {
    let result = null;
    if (node.classList.contains("notion-numbered_list-block")) {
      const textContent = node.textContent as any;
      if (textContent && textContent.length) {
        let i = 0;
        while (!isNaN(textContent[i]) && i < textContent.length) {
          result = (result || "") + textContent[i];
          i++;
        }
        if (result) {
          result = parseInt(result);
        }
      }
    }
    return result;
  }

  private getIsToDoChecked(node: HTMLElement) {
    const contentEditable = node.querySelector<HTMLDivElement>(`[data-content-editable-leaf="true"]`);
    return !!(contentEditable?.style?.textDecoration || "").includes("line-through");
  }

  private getViewBlockTitle(block: HTMLElement) {
    const titleNode = block.querySelector(":scope > div > .notion-collection_view-block [contenteditable]");
    return titleNode?.textContent;
  }

  private hasImages() {
    const childs = Array.from(this.node.querySelectorAll("img"));
    return childs.length > 0;
  }

  /**
   * constructor
   */

  constructor(private node: HTMLDivElement, private isColumnChild?: boolean) {
    this.className = node.className;
    this.id = node.dataset.blockId;
    this.type = Utils.getBlockType(node);
    this.columns = this.getColumns();
    if (!this.columns.length) {
      this.texts = Utils.getTextsFromNode(node);
      if (this.hasImages()) {
        this.imageSelector = `[data-block-id="${this.id}"] img[src]`;
      }
    }
    if (this.type === "numbered-list") {
      this.attributes.listNumber = this.getListNumber(node);
      if (this.texts.length > 1) {
        this.texts.shift();
      }
    }
    if (this.type === "bulleted-list") {
      if (this.texts.length > 1) {
        this.texts.shift();
      }
    }
    if (this.type === "to-do") {
      this.attributes.checked = this.getIsToDoChecked(node);
    }
    if (this.type === "view") {
      this.title = this.getViewBlockTitle(node);
    }
    if (this.type === "embed") {
      this.screenshotSelector = `[data-block-id="${this.id}"] iframe`;
    }
    if (this.type === "view") {
      this.screenshotSelector = `[data-block-id="${this.id}"]`;
    }
  }

  /**
   * public: properties
   */

  public get Id() {
    return this.id;
  }

  public get Title() {
    return this.title;
  }

  public get ClassName() {
    return this.className;
  }

  public get ClassList() {
    return this.classList;
  }

  public get IsColumnChild() {
    return this.isColumnChild;
  }

  public get Columns() {
    return this.columns;
  }

  public get Texts() {
    return this.texts;
  }

  public get ImageSelector() {
    return this.imageSelector;
  }

  public get ImageBuffer() {
    return this.imageBuffer;
  }

  public get ScreenshotSelector() {
    return this.screenshotSelector;
  }

  public get ScreenshotBuffer() {
    return this.screenshotBuffer;
  }

  public get MobileScreenshotBuffer() {
    return this.mobileScreenshotBuffer;
  }

  public get IsChecked() {
    return this.attributes?.checked === true;
  }

  public get ListNumber() {
    return this.attributes?.listNumber ? Number(this.attributes.listNumber) : null;
  }

  /**
   * public: methods
   */

  public setImageBuffer(buffer: Buffer) {
    this.imageBuffer = buffer;
  }

  public setScreenshotBuffer(buffer: Buffer) {
    this.screenshotBuffer = buffer;
  }

  public setMobileScreenshotBuffer(buffer: Buffer) {
    this.mobileScreenshotBuffer = buffer;
  }
}
