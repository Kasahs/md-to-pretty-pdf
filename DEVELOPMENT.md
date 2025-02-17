# Development Notes

This document contains important technical context for continued development of the md-to-pdf tool.

## Current Implementation Details

### PDF Generation Pipeline

1. **Markdown Processing**
   - Uses `marked` for parsing markdown
   - Handles GitHub-flavored markdown features
   - Local image paths are automatically converted to data URLs

2. **HTML Generation**
   - Injects GitHub markdown CSS
   - Applies custom print styles
   - Implements dynamic font sizing through CSS variables
   - Uses CSS transform for document scaling

3. **Puppeteer Configuration**
   - Custom viewport sizing based on A4 dimensions
   - Print media emulation for consistent output
   - Waits for all resources (images, fonts) to load
   - Uses CSS transform instead of Puppeteer's scale option for better control

### Key Technical Decisions

1. **Scaling Implementation**
   - Switched from Puppeteer's scale parameter to CSS transform
   - Reason: Better control over scaling behavior and fewer rendering issues
   - Current approach maintains proper text rendering and image quality

2. **Font Size Management**
   - Base font size controls all text elements proportionally
   - Heading sizes are calculated as multipliers of base size:
     ```
     h1: 2.0x base
     h2: 1.5x base
     h3: 1.25x base
     h4: 1.1x base
     h5: 1.0x base
     h6: 0.9x base
     code: 0.9x base
     ```

3. **Margin Handling**
   - Changed from arbitrary values to standard 1-inch (25.4mm) defaults
   - Margins are applied through Puppeteer's PDF options
   - Each margin can be independently configured

4. **Image Processing**
   - Local images are converted to data URLs
   - SVG files are processed separately for better quality
   - Maintains image paths relative to markdown file location

## Known Limitations

1. **Memory Usage**
   - Large markdown files with many images can be memory-intensive
   - Data URL conversion loads all images into memory

2. **Image Scaling**
   - SVG scaling sometimes behaves differently from raster images
   - Very large images might need special handling

3. **Font Rendering**
   - Custom fonts require explicit loading
   - Font substitution may occur if specified fonts are unavailable

## Recent Changes

1. **Argument Parsing**
   - Added support for both space-separated and equals-separated values
   - Improved validation and error messages
   - Added debug logging for troubleshooting

2. **CSS Improvements**
   - Removed hardcoded font sizes
   - Added important flags to override GitHub CSS
   - Improved print media queries

## Planned Improvements

### Short Term
1. Custom header/footer templates
2. Table of contents generation
3. Multiple file merging

### Medium Term
1. Custom CSS theme support
2. Page size options
3. Watermark support
4. Bookmarks/outline generation

### Long Term
1. Custom font loading
2. Template system
3. Plugin architecture

## Testing Notes

Current manual test cases:
1. Basic markdown conversion
2. Complex markdown with tables and code blocks
3. Documents with local images
4. Various scaling factors (0.5, 0.8, 1.0, 1.2)
5. Different font sizes (12px, 14px, 16px, 18px)
6. Custom margin configurations
7. Very long documents
8. Documents with SVG images

## Development Environment

- Node.js environment
- Puppeteer for PDF generation
- GitHub markdown CSS for styling
- No external services required

## Debugging Tips

1. Enable debug logging:
   ```javascript
   console.log('Parsed values:', {
       scale,
       fontSize,
       margins
   });
   ```

2. Check generated HTML:
   - Set `DEBUG=true` environment variable
   - HTML will be saved before PDF generation

3. Common issues:
   - Image loading failures
   - Font size inheritance problems
   - Margin calculation errors
   - Scale factor application issues
