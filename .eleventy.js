// Insert plugins
const eleventyNavigationPlugin = require("@11ty/eleventy-navigation");
const socialImages = require("@11tyrocks/eleventy-plugin-social-images");
const pluginRss = require("@11ty/eleventy-plugin-rss");
const readingTime = require("eleventy-plugin-reading-time");
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

// Helper packages
const htmlmin = require("html-minifier");
const { DateTime } = require("luxon");

// 11ty
module.exports = function (eleventyConfig) {
  // set markdown footnote processor
  let markdownIt = require("markdown-it");
  let markdownItFootnote = require("markdown-it-footnote");

  let options = {
    html: true,    // Enable HTML tags in source
    breaks: false, // Convert '\n' in paragraphs into <br>
    linkify: true  // Autoconvert URL-like text to links
  };
  
  // configure the library with options
  let markdownLib =  markdownIt(options).use(markdownItFootnote);
  // set the library to process markdown files
  eleventyConfig.setLibrary("md", markdownLib);

  // Apri automaticamente il browser
  eleventyConfig.setBrowserSyncConfig({ open: true });

  // 11ty attivazione plugins
  eleventyConfig.addPlugin(eleventyNavigationPlugin);
  eleventyConfig.addPlugin(socialImages);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(readingTime);

  // Syntax highlighting
  eleventyConfig.addPlugin(syntaxHighlight);

  // Non badare ai file di questa cartella
  eleventyConfig.ignores.delete("src/_11ty/_social/**/*.*");

  // Copia alcuni file statici
  eleventyConfig
    .addPassthroughCopy({ "src/_11ty/_static/app/*.*": "/" })
    .addPassthroughCopy({ "src/_11ty/_static/favicon": "favicon" })
    .addPassthroughCopy({ "src/_11ty/_static/img": "img" });

  // Mostrare l'anno nel footer
  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  // HTML minify
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

  // Data leggibile
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat(
      "dd LLL yyyy"
    );
  });

  // Data Feed
  eleventyConfig.addLiquidFilter("dateToRfc3339", pluginRss.dateToRfc3339);

  // e alla fine
  return {
    markdownTemplateEngine: "njk", // Use nunjucks for templating
    passthroughFileCopy: true,
    // Directory: in, out, etc...
    dir: {
      input: "./src/",
      includes: "/_11ty/_includes/",
      layouts: "/_11ty/_layouts/",
      data: "/_11ty/_data/",
      output: "./public/",
    },
  };
};
