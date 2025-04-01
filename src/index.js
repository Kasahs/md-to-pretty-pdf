/**
 * Markdown to PDF Converter
 *
 * This script converts markdown files to PDF with GitHub-style rendering and syntax highlighting.
 * It uses marked for markdown parsing, highlight.js for code syntax highlighting,
 * and puppeteer for PDF generation.
 */

const fs = require("fs").promises;
const path = require("path");
const { Marked } = require("marked");
const { markedHighlight } = require("marked-highlight");
const puppeteer = require("puppeteer");
const hljs = require("highlight.js");
const { Command } = require("commander");

// Register commonly used languages for syntax highlighting
// This allows highlight.js to recognize and highlight these languages in code blocks
hljs.registerLanguage(
  "javascript",
  require("highlight.js/lib/languages/javascript")
);
hljs.registerLanguage("python", require("highlight.js/lib/languages/python"));
hljs.registerLanguage("bash", require("highlight.js/lib/languages/bash"));
hljs.registerLanguage("json", require("highlight.js/lib/languages/json"));
hljs.registerLanguage("html", require("highlight.js/lib/languages/xml"));
hljs.registerLanguage("css", require("highlight.js/lib/languages/css"));

// Configure marked with highlight.js integration
// We use marked-highlight as recommended by the marked documentation
// This ensures proper syntax highlighting in code blocks
const marked = new Marked(
  markedHighlight({
    langPrefix: "hljs language-", // Required by highlight.js for language detection
    highlight(code, lang) {
      // If language is specified and supported, use it; otherwise fallback to plaintext
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    },
  })
);

/**
 * Processes an SVG file to ensure it's valid and can be embedded in HTML
 *
 * @param {string} filePath - Path to the SVG file
 * @returns {string|null} SVG content if valid, null otherwise
 */
async function processSVG(filePath) {
  try {
    const svgContent = await fs.readFile(filePath, "utf-8");
    // Basic validation that it's an SVG file
    if (!svgContent.includes("<svg")) {
      throw new Error("Not a valid SVG file");
    }
    return svgContent;
  } catch (error) {
    console.warn(
      `Warning: Could not process SVG ${filePath}: ${error.message}`
    );
    return null;
  }
}

/**
 * Converts an image to a data URL for embedding in HTML
 *
 * @param {string} imagePath - Path to the image file
 * @returns {string|null} Data URL if successful, null otherwise
 */
async function imageToDataURL(imagePath) {
  try {
    // Handle SVG files differently
    if (path.extname(imagePath).toLowerCase() === ".svg") {
      const svgContent = await processSVG(imagePath);
      return svgContent
        ? `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`
        : null;
    }

    // Handle other image formats
    const imageBuffer = await fs.readFile(imagePath);
    const extension = path.extname(imagePath).toLowerCase().substring(1);
    const mimeType = `image/${extension === "jpg" ? "jpeg" : extension}`;
    return `data:${mimeType};base64,${imageBuffer.toString("base64")}`;
  } catch (error) {
    console.warn(
      `Warning: Could not load image ${imagePath}: ${error.message}`
    );
    return imagePath; // Return original path if conversion fails
  }
}

/**
 * Replaces local image paths in HTML with their data URLs
 *
 * @param {string} html - The HTML content
 * @param {string} basePath - Base path for resolving relative image paths
 * @returns {string} HTML with local images replaced
 */
async function processLocalImages(html, basePath) {
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  const images = [...html.matchAll(imgRegex)];

  for (const match of images) {
    const [fullMatch, src] = match;
    // Only process local images (not URLs)
    if (
      !src.startsWith("http://") &&
      !src.startsWith("https://") &&
      !src.startsWith("data:")
    ) {
      const absoluteImagePath = path.resolve(basePath, src);
      try {
        const dataUrl = await imageToDataURL(absoluteImagePath);
        if (dataUrl) {
          html = html.replace(src, dataUrl);
        }
      } catch (error) {
        console.warn(
          `Warning: Could not process image ${src}: ${error.message}`
        );
      }
    }
  }

  return html;
}

/**
 * Generates the HTML document with proper styling
 *
 * @param {string} html - The converted markdown content
 * @param {Object} options - Configuration options including fontSize
 * @returns {string} Complete HTML document with all necessary styles
 */
async function generateHTML(html, options) {
  // Load CSS files in the correct order to ensure proper styling

  // 1. Custom CSS for basic layout and print settings
  const customCss = await fs.readFile(
    path.join(__dirname, "styles.css"),
    "utf-8"
  );

  // 2. GitHub markdown CSS for the overall markdown styling
  const githubCss = await fs.readFile(
    require.resolve("github-markdown-css/github-markdown.css"),
    "utf-8"
  );

  // 3. Highlight.js theme CSS for code syntax highlighting
  const highlightCss = await fs.readFile(
    require.resolve("highlight.js/styles/github.css"),
    "utf-8"
  );

  // Combine everything into a single HTML document
  // The order of CSS is important: GitHub CSS -> Highlight.js CSS -> Custom CSS
  // This allows our custom styles to override when necessary
  return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            ${githubCss}
            ${highlightCss}
            ${customCss}
            .markdown-body { font-size: ${options.fontSize}px; }
        </style>
    </head>
    <body class="markdown-body">
        ${html}
    </body>
    </html>`;
}

/**
 * Writes debug information to a log file
 * Only active when debug mode is enabled
 *
 * @param {string} message - Message to log
 * @param {any} data - Data to log (will be stringified)
 */
async function debugLog(message, data) {
  if (!global.DEBUG_MODE) return;

  const logPath = path.join(process.cwd(), "debug", "log.txt");
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n${JSON.stringify(
    data,
    null,
    2
  )}\n\n`;

  // Ensure debug directory exists
  await fs.mkdir(path.join(process.cwd(), "debug"), { recursive: true });
  await fs.appendFile(logPath, logMessage);
}

/**
 * Writes HTML content to a temporary file for debugging
 * Only active when debug mode is enabled
 *
 * @param {string} html - HTML content to write
 * @param {string} stage - Stage of conversion (e.g., 'markdown', 'final')
 */
async function writeDebugHtml(html, stage) {
  if (!global.DEBUG_MODE) return;

  const debugDir = path.join(process.cwd(), "debug");
  await fs.mkdir(debugDir, { recursive: true });
  await fs.writeFile(path.join(debugDir, `${stage}.html`), html);
}

/**
 * Converts markdown to PDF with the specified options
 *
 * @param {string} inputPath - Path to the markdown file
 * @param {Object} options - Configuration options
 * @param {number} options.scale - Scale factor for the PDF
 * @param {number} options.fontSize - Base font size in pixels
 * @param {Object} options.margins - Margin settings in mm (top, right, bottom, left)
 */
async function convertMarkdownToPdf(inputPath, options = {}) {
  try {
    const baseDir = path.dirname(inputPath);

    // Read markdown file
    const markdown = await fs.readFile(inputPath, "utf-8");
    await debugLog("Input Markdown", { content: markdown });

    // Convert markdown to HTML
    let html = marked.parse(markdown);
    await debugLog("Generated HTML", { content: html });
    await writeDebugHtml(html, "markdown");

    // Process local images
    html = await processLocalImages(html, baseDir);
    await debugLog("HTML with processed images", { content: html });

    // Generate final HTML with styles
    const finalHtml = await generateHTML(html, options);
    await debugLog("Final HTML with styles", { content: finalHtml });
    await writeDebugHtml(finalHtml, "final");

    // Launch browser and create PDF
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set timeout for network requests to 30 seconds
    await page.setDefaultNavigationTimeout(30000);
    await page.setDefaultTimeout(30000);

    // Enable request interception to track image loading
    await page.setRequestInterception(true);
    const pendingImages = new Set();

    page.on("request", (request) => {
      if (request.resourceType() === "image") {
        pendingImages.add(request.url());
      }
      request.continue();
    });

    page.on("requestfailed", (request) => {
      if (request.resourceType() === "image") {
        console.warn(`Warning: Failed to load image: ${request.url()}`);
        pendingImages.delete(request.url());
      }
    });

    page.on("requestfinished", (request) => {
      if (request.resourceType() === "image") {
        pendingImages.delete(request.url());
      }
    });

    // Calculate viewport size based on A4 dimensions and scale
    // A4 is 210mm × 297mm, convert to pixels at 96 DPI
    const mmToPixels = (mm) => Math.floor((mm * 96) / 25.4);
    const viewportWidth = mmToPixels(210);
    const viewportHeight = mmToPixels(297);

    await page.setViewport({
      width: viewportWidth,
      height: viewportHeight,
      deviceScaleFactor: 1,
    });

    // Set print media for proper rendering
    await page.emulateMediaType("print");

    // Load content and wait for initial network idle
    await page.setContent(finalHtml, {
      waitUntil: ["networkidle0", "load", "domcontentloaded"],
    });

    // Double-check that all images are loaded
    await page.evaluate(async () => {
      const images = Array.from(document.getElementsByTagName("img"));
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth !== 0) return Promise.resolve();
          return new Promise((resolve, reject) => {
            img.addEventListener("load", resolve);
            img.addEventListener("error", () => {
              console.warn(`Failed to load image: ${img.src}`);
              resolve(); // Resolve anyway to not block PDF generation
            });
          });
        })
      );
    });

    // Wait for any remaining image requests to complete or fail
    while (pendingImages.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Apply scale to content if needed
    if (options.scale !== 1.0) {
      await page.evaluate((scale) => {
        document.body.style.transform = `scale(${scale})`;
        document.body.style.transformOrigin = "top left";
      }, options.scale);
    }

    // Generate output path in the same directory as input file
    const outputPath = inputPath.replace(/\.md$/, ".pdf");

    await page.pdf({
      path: outputPath,
      format: "A4",
      margin: {
        top: `${options.margins.top}mm`,
        right: `${options.margins.right}mm`,
        bottom: `${options.margins.bottom}mm`,
        left: `${options.margins.left}mm`,
      },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
                <div style="font-size: 10px; text-align: center; width: 100%; margin: 0 50px;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                </div>
            `,
      preferCSSPageSize: true,
    });

    await browser.close();
    await debugLog("PDF Generation", {
      outputPath,
      options: {
        scale: options.scale,
        fontSize: options.fontSize,
        margins: options.margins,
      },
    });

    console.log(`PDF created successfully at: ${outputPath}`);
    console.log(
      `Settings used: scale=${options.scale}, font-size=${options.fontSize}px, margins: top=${options.margins.top}mm, right=${options.margins.right}mm, bottom=${options.margins.bottom}mm, left=${options.margins.left}mm`
    );
  } catch (error) {
    await debugLog("Error", {
      message: error.message,
      stack: error.stack,
    });
    console.error("Error:", error);
    process.exit(1);
  }
}

// Initialize commander
const program = new Command();

program
  .option("--debug", "Enable debug mode")
  .option("--scale <number>", "Scale factor for the PDF", parseFloat, 1.0)
  .option("--font-size <number>", "Base font size in pixels", (value) => parseInt(value, 10), 16)
  .option("--margin <number>", "Margin settings in mm", parseFloat)
  .arguments("<inputPath>")
  .action((inputPath) => {
    const options = program.opts();
    options.fontSize = options.fontSize || 16; // Ensure fontSize is set
    if (options.margin) {
      options.margins = {
        top: options.margin,
        right: options.margin,
        bottom: options.margin,
        left: options.margin,
      };
    } else {
      options.margins = {
        top: 25.4,
        right: 25.4,
        bottom: 25.4,
        left: 25.4,
      };
    }
    console.log("Options:", options);
    convertMarkdownToPdf(inputPath, options);
  });

program.parse(process.argv);
