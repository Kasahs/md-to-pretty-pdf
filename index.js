const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');
const puppeteer = require('puppeteer');

// Configure marked for GitHub-flavored markdown
marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: true
});

async function processSVG(filePath) {
    try {
        const svgContent = await fs.readFile(filePath, 'utf-8');
        // Basic validation that it's an SVG file
        if (!svgContent.includes('<svg')) {
            throw new Error('Not a valid SVG file');
        }
        return svgContent;
    } catch (error) {
        console.warn(`Warning: Could not process SVG ${filePath}: ${error.message}`);
        return null;
    }
}

async function imageToDataURL(imagePath) {
    try {
        // Handle SVG files differently
        if (path.extname(imagePath).toLowerCase() === '.svg') {
            const svgContent = await processSVG(imagePath);
            return svgContent ? `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}` : null;
        }

        // Handle other image formats
        const imageBuffer = await fs.readFile(imagePath);
        const extension = path.extname(imagePath).toLowerCase().substring(1);
        const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
        return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
        console.warn(`Warning: Could not load image ${imagePath}: ${error.message}`);
        return imagePath; // Return original path if conversion fails
    }
}

async function processLocalImages(html, basePath) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
    const images = [...html.matchAll(imgRegex)];
    
    for (const match of images) {
        const [fullMatch, src] = match;
        // Only process local images (not URLs)
        if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
            const absoluteImagePath = path.resolve(basePath, src);
            try {
                const dataUrl = await imageToDataURL(absoluteImagePath);
                if (dataUrl) {
                    html = html.replace(src, dataUrl);
                }
            } catch (error) {
                console.warn(`Warning: Could not process image ${src}: ${error.message}`);
            }
        }
    }
    
    return html;
}

async function convertMarkdownToPdf(inputPath, scale, fontSize, margins) {
    try {
        // Validate input file exists
        try {
            await fs.access(inputPath);
        } catch (error) {
            console.error(`Error: Input file "${inputPath}" does not exist`);
            process.exit(1);
        }

        // Get the directory of the input file for resolving relative paths
        const baseDir = path.dirname(inputPath);

        // Generate output path in the same directory as input file
        const outputPath = inputPath.replace(/\.md$/, '.pdf');
        
        // Read markdown file
        const markdown = await fs.readFile(inputPath, 'utf-8');
        
        // Convert markdown to HTML
        let html = marked(markdown);

        // Process local images
        html = await processLocalImages(html, baseDir);
        
        // Read our custom CSS which includes GitHub markdown CSS and print styles
        const customCss = await fs.readFile(
            path.join(__dirname, 'styles.css'),
            'utf-8'
        );

        // Create full HTML document with GitHub styling and print styles
        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    ${customCss}
                    .markdown-body {
                        font-size: ${fontSize}px !important;
                    }
                    .markdown-body pre,
                    .markdown-body code {
                        font-size: ${Math.floor(fontSize * 0.9)}px !important;
                    }
                    .markdown-body h1 { font-size: ${fontSize * 2}px !important; }
                    .markdown-body h2 { font-size: ${fontSize * 1.5}px !important; }
                    .markdown-body h3 { font-size: ${fontSize * 1.25}px !important; }
                    .markdown-body h4 { font-size: ${fontSize * 1.1}px !important; }
                    .markdown-body h5 { font-size: ${fontSize}px !important; }
                    .markdown-body h6 { font-size: ${fontSize * 0.9}px !important; }
                </style>
            </head>
            <body class="markdown-body">
                ${html}
            </body>
            </html>
        `;
        
        // Launch browser and create PDF
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        // Calculate viewport size based on A4 dimensions and scale
        // A4 is 210mm × 297mm, convert to pixels at 96 DPI
        const mmToPixels = (mm) => Math.floor(mm * 96 / 25.4);
        const viewportWidth = mmToPixels(210);
        const viewportHeight = mmToPixels(297);
        
        await page.setViewport({
            width: viewportWidth,
            height: viewportHeight,
            deviceScaleFactor: 1
        });

        // Set print media for proper rendering
        await page.emulateMediaType('print');
        
        await page.setContent(fullHtml, { 
            waitUntil: ['networkidle0', 'load', 'domcontentloaded']
        });

        // Ensure all images are loaded
        await page.evaluate(async () => {
            const selectors = Array.from(document.getElementsByTagName('img'));
            await Promise.all(selectors.map(img => {
                if (img.complete) return;
                return new Promise((resolve, reject) => {
                    img.addEventListener('load', resolve);
                    img.addEventListener('error', reject);
                });
            }));
        });

        // Apply scale to content if needed
        if (scale !== 1.0) {
            await page.evaluate((scale) => {
                document.body.style.transform = `scale(${scale})`;
                document.body.style.transformOrigin = 'top left';
            }, scale);
        }

        await page.pdf({
            path: outputPath,
            format: 'A4',
            margin: {
                top: `${margins.top}mm`,
                right: `${margins.right}mm`,
                bottom: `${margins.bottom}mm`,
                left: `${margins.left}mm`
            },
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="font-size: 10px; text-align: center; width: 100%; margin: 0 50px;">
                    <span class="pageNumber"></span> / <span class="totalPages"></span>
                </div>
            `,
            preferCSSPageSize: true
        });

        await browser.close();
        console.log(`PDF created successfully at: ${outputPath}`);
        console.log(`Settings used: scale=${scale}, font-size=${fontSize}px, margins: top=${margins.top}mm, right=${margins.right}mm, bottom=${margins.bottom}mm, left=${margins.left}mm`);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Get input file path and options from command line arguments
const args = process.argv.slice(2);

// Debug logging
console.log('Received arguments:', args);

if (args.length < 1) {
    console.error('Usage: node index.js <input-markdown-file> [options]');
    console.error('Options:');
    console.error('  --scale <factor>       Scale factor (default: 1.0)');
    console.error('  --font-size <px>       Base font size in pixels (default: 16)');
    console.error('  --margin-top <mm>      Top margin in mm (default: 25.4)');
    console.error('  --margin-right <mm>    Right margin in mm (default: 25.4)');
    console.error('  --margin-bottom <mm>   Bottom margin in mm (default: 25.4)');
    console.error('  --margin-left <mm>     Left margin in mm (default: 25.4)');
    console.error('\nNote: Default margins are 1 inch (25.4mm) as per standard document guidelines');
    console.error('Example: node index.js input.md --scale 0.8 --font-size 14');
    console.error('\nWhen using npm run convert, use -- to pass arguments:');
    console.error('npm run convert -- input.md --scale 0.8 --font-size 14');
    process.exit(1);
}

const inputPath = args[0];

// Parse arguments with defaults - improved to handle both = and space separated values
const getArgValue = (flag, defaultValue) => {
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        // Handle --arg=value format
        if (arg.startsWith(`${flag}=`)) {
            return parseFloat(arg.split('=')[1]);
        }
        // Handle --arg value format
        if (arg === flag && i + 1 < args.length) {
            return parseFloat(args[i + 1]);
        }
    }
    return defaultValue;
};

// Standard margin is 1 inch (25.4mm)
const STANDARD_MARGIN = 25.4;
const DEFAULT_FONT_SIZE = 16;

const scale = getArgValue('--scale', 1.0);
const fontSize = getArgValue('--font-size', DEFAULT_FONT_SIZE);
const margins = {
    top: getArgValue('--margin-top', STANDARD_MARGIN),
    right: getArgValue('--margin-right', STANDARD_MARGIN),
    bottom: getArgValue('--margin-bottom', STANDARD_MARGIN),
    left: getArgValue('--margin-left', STANDARD_MARGIN)
};

// Debug logging
console.log('Parsed values:', {
    scale,
    fontSize,
    margins
});

// Validate scale factor
if (isNaN(scale) || scale <= 0) {
    console.error('Error: Scale factor must be a positive number');
    process.exit(1);
}

// Validate font size
if (isNaN(fontSize) || fontSize <= 0) {
    console.error('Error: Font size must be a positive number');
    process.exit(1);
}

// Validate margins
Object.entries(margins).forEach(([side, value]) => {
    if (isNaN(value) || value < 0) {
        console.error(`Error: ${side} margin must be a non-negative number`);
        process.exit(1);
    }
});

// Call the conversion function with all parameters
convertMarkdownToPdf(inputPath, scale, fontSize, margins);
