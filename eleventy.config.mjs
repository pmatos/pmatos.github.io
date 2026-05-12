import eleventyNavigationPlugin from "@11ty/eleventy-navigation";
import pluginRss, { dateToRfc3339 } from "@11ty/eleventy-plugin-rss";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

import markdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";
import htmlmin from "html-minifier-terser";
import { DateTime } from "luxon";

import lyInsert from "./filters/lyInsert.js";

export default function (eleventyConfig) {
  eleventyConfig.addWatchTarget("./filters");

  const markdownLib = markdownIt({
    html: true,
    breaks: false,
    linkify: true,
  }).use(markdownItFootnote);
  eleventyConfig.setLibrary("md", markdownLib);

  eleventyConfig.setBrowserSyncConfig({ open: true });

  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.ignores.delete("src/_11ty/_social/**/*.*");

  eleventyConfig.addPairedShortcode("lyInsert", lyInsert);

  eleventyConfig
    .addPassthroughCopy({ "src/_11ty/_static/app/*.*": "/" })
    .addPassthroughCopy({ "src/_11ty/_static/favicon": "favicon" })
    .addPassthroughCopy({ "src/_11ty/_static/img": "img" })
    .addPassthroughCopy({ "src/_11ty/_static/examples": "examples" });

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  eleventyConfig.addTransform("htmlmin", (content, outputPath) => {
    if (outputPath.endsWith(".html")) {
      return htmlmin.minify(content, {
        collapseWhitespace: true,
        removeComments: true,
        useShortDoctype: true,
      });
    }
    return content;
  });

  eleventyConfig.addFilter("readableDate", (dateObj) => {
    const dateTime = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dateTime.toFormat("dd LLL yyyy");
  });

  eleventyConfig.addLiquidFilter("dateToRfc3339", dateToRfc3339);

  return {
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true,
    dir: {
      input: "./src/",
      includes: "/_11ty/_includes/",
      layouts: "/_11ty/_layouts/",
      data: "/_11ty/_data/",
      output: "./public/",
    },
  };
}
