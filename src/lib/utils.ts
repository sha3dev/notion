/**
 * imports: externals
 */

/**
 * imports: internals
 */

import rgbHex from "rgb-hex";

/**
 * module: initializations
 */

/**
 * types
 */

export type DataAtrribute = "bold" | "italic" | "strikethrough" | "underline" | "code" | "color" | "backgroundColor";

export type NotionBlockText = {
  className?: string;
  attributes?: Partial<Record<DataAtrribute, unknown>>;
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

export default abstract class Utils {
  /**
   * public: methods
   */

  /* public static getImgSrc(img: any, protocol?: string) {
    if (img && img.src) {
      if (img.src.startsWith("/")) {
        return `${protocol ? `${protocol}:` : ""}//www.notion.so${img.src}`;
      } else {
        return img.src as string;
      }
    }
    return null;
  } */

  public static getStylesFromNode(node: HTMLElement) {
    let styles: Record<string, string> = {};
    if (node?.getAttribute) {
      const raw = node.getAttribute("style");
      if (typeof raw === "string") {
        raw
          .split(";")
          .filter((item) => item.includes(":"))
          .forEach((property) => {
            const [key, value] = property.split(":");
            if (key && value) {
              styles[key?.trim()] = value?.trim();
            }
          });
        if ((node as any)._styles) {
          styles = Object.assign((node as any)._styles, styles);
        }
      }
    }
    return styles;
  }

  public static getBlockType(node: HTMLElement) {
    const classList = node.className.split(/\s+/);
    if (classList.includes("notion-column-block")) {
      return "column";
    } else if (classList.includes("notion-column_list-block")) {
      return "column-list";
    } else if (classList.includes("notion-collection_view-block")) {
      return "view";
    } else if (classList.includes("notion-embed-block")) {
      return "embed";
    } else if (classList.includes("notion-text-block")) {
      return "text";
    } else if (classList.includes("notion-header-block")) {
      return "header-1";
    } else if (classList.includes("notion-sub_header-block")) {
      return "header-2";
    } else if (classList.includes("notion-sub_sub_header-block")) {
      return "header-3";
    } else if (classList.includes("notion-to_do-block")) {
      return "to-do";
    } else if (classList.includes("notion-bulleted_list-block")) {
      return "bulleted-list";
    } else if (classList.includes("notion-numbered_list-block")) {
      return "numbered-list";
    } else if (classList.includes("notion-quote-block")) {
      return "quote";
    } else if (classList.includes("notion-callout-block")) {
      return "callout";
    } else if (classList.includes("notion-code-block")) {
      return "code";
    } else if (classList.includes("notion-divider-block")) {
      return "divider";
    } else if (classList.includes("notion-image-block")) {
      return "image";
    } else {
      return "unsupported";
    }
  }

  public static getDataAttributesFromStyle(style: Record<string, string>) {
    const dataAttributes: Partial<Record<DataAtrribute, unknown>> = {};
    if (style) {
      Object.keys(style).forEach((key) => {
        const value = style[key];
        if (key === "font-weight") {
          dataAttributes.bold = value === "600" || value === "bold" || value === "bolder";
        } else if (key === "font-style") {
          dataAttributes.italic = value === "italic";
        } else if (key === "text-decoration") {
          dataAttributes.strikethrough = value && value.includes("line-through");
        } else if (key === "border-bottom") {
          dataAttributes.underline = true;
        } else if (key === "font-family" && value && value.includes("monospace")) {
          dataAttributes.code = true;
        } else if (key === "color" && value) {
          const styleColor = value.toLowerCase().trim();
          if (!["inherit", "initial"].includes(styleColor)) {
            if (styleColor.startsWith("rgb")) {
              let color = null;
              try {
                color = rgbHex(styleColor);
                if (color) {
                  color = `#${color}`;
                }
              } catch (e) {
                color = null;
              }
              dataAttributes.color = color;
            } else {
              dataAttributes.color = styleColor;
            }
          }
        } else if (key === "background" && value) {
          const styleBackgroundColor = value.toLowerCase().trim();
          if (!["inherit", "initial"].includes(styleBackgroundColor)) {
            if (styleBackgroundColor.startsWith("rgb")) {
              let backgroundColor = null;
              try {
                backgroundColor = rgbHex(styleBackgroundColor);
                backgroundColor && (backgroundColor = `#${backgroundColor}`);
              } catch (e) {
                backgroundColor = null;
              }
              dataAttributes.backgroundColor = backgroundColor;
            } else {
              dataAttributes.backgroundColor = styleBackgroundColor;
            }
          }
        }
      });
    }
    return dataAttributes;
  }

  public static getTextChilds(node: HTMLElement) {
    let result: HTMLElement[] = [];
    const childNodes = Array.from(node.childNodes).filter((item: any) => item.textContent);
    if (childNodes.length === 1 && childNodes[0].nodeName === "#text") {
      result.push(node);
    } else {
      childNodes.forEach((childNode: HTMLElement) => {
        if (childNode.nodeName === "DIV") {
          result = result.concat(this.getTextChilds(childNode as HTMLDivElement));
        } else if (["#text", "SPAN"].includes(childNode.nodeName)) {
          result.push(childNode);
        } else if (childNode.nodeName === "A") {
          const anchorChilds = Array.from(childNode.childNodes);
          const anchorStyles = this.getStylesFromNode(childNode as HTMLAnchorElement);
          anchorChilds.forEach((anchorChild: HTMLElement) => {
            (anchorChild as any).href = (childNode as HTMLAnchorElement).href;
            (anchorChild as any)._styles = anchorStyles;
            result.push(anchorChild);
          });
        }
      });
    }
    return result;
  }

  public static getTextsFromNode(node: HTMLElement) {
    const notionBlockTexts: NotionBlockText[] = [];
    if (node) {
      let childs = Array.from(node.querySelectorAll("span,[contenteditable]"));
      childs = childs.filter(
        (item: any) =>
          item.textContent &&
          !childs.find(
            (parent) =>
              item.parentNode === parent ||
              item.parentNode?.parentNode === parent ||
              item.parentNode?.parentNode?.parentNode === parent
          )
      );
      childs.forEach((childParent: HTMLElement) => {
        const textChilds = this.getTextChilds(childParent);
        textChilds.forEach((child) => {
          if (child?.textContent) {
            const style = this.getStylesFromNode(child);
            const attributes = this.getDataAttributesFromStyle(style);
            const notionBlockText: NotionBlockText = {
              plainText: child.textContent,
              attributes,
              style,
              className: child.className,
              href: (child as HTMLAnchorElement)?.href || (child?.parentNode as HTMLAnchorElement)?.href,
            };
            if (style["font-family"] && style["font-family"].toLowerCase().includes("emoji")) {
              const ariaLabel = child.getAttribute("aria-label");
              notionBlockText.emoji = ariaLabel ? ariaLabel.trim() : null;
            }
            notionBlockTexts.push(notionBlockText);
          }
        });
      });
    }
    return notionBlockTexts;
  }

  /* public static getImagesFromNode(node: HTMLElement) {
    const images: string[] = [];
    if (node) {
      const childs = Array.from(node.querySelectorAll("img"));
      childs.forEach((child: any) => {
        const src = this.getImgSrc(child, "https");
        if (src) {
          images.push(src);
        }
      });
    }
    return images;
  } */
}
