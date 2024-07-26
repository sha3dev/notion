/**
 * imports: externals
 */

import Logger from "@sha3/logger";
import { randomUUID } from "crypto";
import * as path from "path";
import * as fs from "node:fs/promises";

/**
 * imports: internals
 */

import { FetchResult } from "./fetch";

/**
 * module: initializations
 */

const logger = new Logger("notion");

/**
 * types
 */

export type EmailOptions = { rootFolder: string };

export type GenerateEmailOptions = { fetchResult: FetchResult };

/**
 * consts
 */

/**
 * export
 */

export default class Email {
  /**
   * private: attributes
   */

  private emailFolder: string;

  /**
   * private: methods
   */

  private async saveBuffer(folder: string, fileName: string, buffer: Buffer) {
    const bufferPath = path.join(folder, fileName);
    await fs.writeFile(bufferPath, buffer);
    return bufferPath;
  }

  /**
   * constructor
   */

  constructor(private options: EmailOptions) {
    const { rootFolder } = this.options;
  }

  /**
   * public : methods
   */

  public async generateEmail(options: GenerateEmailOptions) {
    const { rootFolder } = this.options;
    const { fetchResult } = options;
    const emailFolder = path.join(rootFolder, `/${new Date().toISOString().split("T")[0]}/${randomUUID()}`);
    await fs.mkdir(emailFolder, { recursive: true });
    const { emojis, icon, coverImage, allBlocks } = fetchResult;
    // save emojis
    const emojisPaths: Record<string, string> = {};
    for (let key in emojis) {
      emojisPaths[key] = await this.saveBuffer(emailFolder, `emoji-${key}.png`, emojis[key]);
    }
    // save icon
    let iconPath: string;
    if (icon) {
      iconPath = await this.saveBuffer(emailFolder, "icon.png", icon);
    }
    // save cover
    let coverImagePath: string;
    if (coverImage) {
      coverImagePath = await this.saveBuffer(emailFolder, "cover.png", coverImage);
    }
    // blocks
    const imagesPaths: Record<string, string> = {};
    const screenshotsPaths: Record<string, string> = {};
    for (const block of allBlocks) {
      // save image
      if (block.ImageBuffer) {
        imagesPaths[block.Id] = await this.saveBuffer(emailFolder, `image-${block.Id}.png`, block.ImageBuffer);
      }
      // save screenshot
      if (block.ScreenshotBuffer) {
        screenshotsPaths[block.Id] = await this.saveBuffer(
          emailFolder,
          `screenshot-${block.Id}.png`,
          block.ScreenshotBuffer
        );
      }
      // save mobile screenshot
      if (block.MobileScreenshotBuffer) {
        screenshotsPaths[block.Id] = await this.saveBuffer(
          emailFolder,
          `screenshot-mobile-${block.Id}.png`,
          block.MobileScreenshotBuffer
        );
      }
    }
  }
}
