// Gera public/apple-touch-icon.png (180x180) a partir da folha da marca.
// Uso pontual de geração de asset; sharp é instalado com --no-save (não vira
// dependência do app). Folha BRANCA sobre fundo navy em gradiente, com respiro.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = resolve(__dirname, "../public/apple-touch-icon.png");

// Folha centralizada num quadrado 180x180. A folha original ocupa ~x[20..80],
// y[8..142] (100x150). Escala 0.92 → ~123px de altura, deixando boa margem.
const s = 0.92;
const tx = 90 - s * 50; // centraliza o eixo x da folha (x=50) em 90
const ty = 90 - s * 75; // centraliza o eixo y da folha (y=75) em 90

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#27567f"/>
      <stop offset="1" stop-color="#0f2c46"/>
    </linearGradient>
  </defs>
  <rect width="180" height="180" fill="url(#bg)"/>
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s})"
     fill="none" stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round">
    <path d="M50 8 C80 44 80 106 50 142 C20 106 20 44 50 8 Z" stroke-width="3.2"/>
    <path d="M50 24 C68 50 68 100 50 126 C32 100 32 50 50 24 Z" stroke-width="2.4"/>
    <path d="M50 16 C34 42 42 80 50 102" stroke-width="2.4"/>
    <path d="M50 16 C66 42 58 80 50 102" stroke-width="2.4"/>
    <path d="M50 102 C40 114 40 128 50 136 C60 128 60 114 50 102 Z" stroke-width="2.4"/>
    <path d="M50 16 C45 24 45 32 50 38 C55 32 55 24 50 16 Z" stroke-width="2.4"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(out);
console.log("gerado:", out);
