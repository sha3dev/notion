/**
 * imports: externals
 */

import * as assert from "node:assert";
import { test } from "node:test";
import * as path from "path";
import { NotionFetch, NotionEmail } from "../src/index";

/**
 * env init
 */

require("dotenv").config({ path: [".env", "../.env"] });

/**
 * consts
 */

const WORK_FOLDER = path.join(__dirname, "output");

const NOTION_PAGE_URL = "https://jc-ninja.notion.site/The-Cupcakes-Newsletter-57773a2257a44e02945d338bcfcfb9e3";

const NOTION_FETCH_OPTIONS = { coverImageHeight: 200, bodyMaxWidth: 700, viewBlockBackgroundColor: "#fff" };

/**
 * tests
 */

/*
    BODY_MAX_WIDTH: parseInt(ENV.BODY_MAX_WIDTH || '708'),
    BODY_TABLET_BREAKPOINT: parseInt(ENV.BODY_TABLET_BREAKPOINT || '708'),
    BODY_MOBILE_BREAKPOINT: parseInt(ENV.BODY_MOBILE_BREAKPOINT || '500'),
    COVER_IMAGE_HEIGHT: parseInt(ENV.COVER_IMAGE_HEIGHT || '200'),
    VIEW_BACKGROUND_COLOR: ENV.VIEW_BACKGROUND_COLOR || '#ffffff',
*/

test("Test fetch notion page", async () => {
  try {
    const fetch = new NotionFetch(NOTION_FETCH_OPTIONS);
    const fetchResult = await fetch.loadFromPublicUrl({ url: NOTION_PAGE_URL });
    const email = new NotionEmail({ rootFolder: WORK_FOLDER });
    await email.generateEmail({ fetchResult });
    assert.ok(!!email);
  } catch (e: any) {
    console.error(e.stack);
    throw e;
  }
});
