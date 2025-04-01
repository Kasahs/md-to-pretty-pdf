const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create a 150x150 canvas
const canvas = createCanvas(150, 150);
const ctx = canvas.getContext('2d');

// Fill background
ctx.fillStyle = '#4A90E2';
ctx.fillRect(0, 0, 150, 150);

// Add text
ctx.fillStyle = '#FFFFFF';
ctx.font = '16px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Local PNG', 75, 75);

// Save to file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(__dirname, 'sample.png'), buffer);
