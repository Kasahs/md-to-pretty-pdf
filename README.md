# Markdown to PDF Converter

A flexible Node.js tool for converting Markdown files to PDF with GitHub-flavored markdown styling, customizable scaling, font sizes, and margins.

## Features

- GitHub-flavored markdown support
- Customizable page margins
- Adjustable font sizes for better content compaction
- Document scaling options
- Local image support
- Page numbers
- Clean, professional output

## Installation

```bash
npm install
```

## Dependencies

- puppeteer: For PDF generation
- marked: For Markdown parsing
- github-markdown-css: For GitHub-style markdown rendering

## Usage

Basic usage:
```bash
node index.js input.md
```

With options:
```bash
node index.js input.md --font-size=14 --margin-right=15 --margin-left=15
```

Using npm script:
```bash
npm run convert -- input.md --scale=0.8 --font-size=14
```

### Options

- `--scale <factor>`: Scale factor for the entire document (default: 1.0)
- `--font-size <px>`: Base font size in pixels (default: 16)
- `--margin-top <mm>`: Top margin in mm (default: 25.4)
- `--margin-right <mm>`: Right margin in mm (default: 25.4)
- `--margin-bottom <mm>`: Bottom margin in mm (default: 25.4)
- `--margin-left <mm>`: Left margin in mm (default: 25.4)

## File Structure

- `index.js`: Main conversion logic
- `styles.css`: Custom CSS styling
- `package.json`: Project dependencies and scripts

## Implementation Details

### Scaling Options

The tool provides two ways to control the output size:

1. **Font Size (`--font-size`)**: 
   - Changes the base font size of the document
   - Automatically scales headings and code blocks proportionally
   - Most effective for reducing page count
   - Maintains proper text hierarchy

2. **Document Scale (`--scale`)**:
   - Scales the entire document including images
   - Useful for fine-tuning the overall appearance
   - Doesn't affect content flow

### Margins

- Uses standard 1-inch (25.4mm) margins by default
- Each margin can be customized independently
- Supports both millimeter values

### CSS Styling

- Uses GitHub markdown CSS as base
- Custom print media styles for better PDF output
- Proportional heading sizes based on base font size
- Code block styling with proper font scaling

## Development Notes

Current Implementation:
- Uses Puppeteer's PDF generation with custom viewport sizing
- Implements CSS transform for scaling
- Handles local image paths automatically
- Waits for full content load before PDF generation

Future Improvements:
1. Add header/footer customization
2. Support for custom CSS themes
3. Table of contents generation
4. Multiple markdown file merging
5. Custom page size options
6. Watermark support

## Security Considerations

- Input validation for all command-line arguments
- Safe handling of local file paths
- No exposure of sensitive error details
