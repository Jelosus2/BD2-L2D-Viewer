import { cp, mkdir } from 'node:fs/promises'

const assetDirectories = ['spines', 'audios']

await mkdir('dist/assets', { recursive: true })
await Promise.all(
  assetDirectories.map(directory =>
    cp(`src/assets/${directory}`, `dist/assets/${directory}`, { recursive: true }),
  ),
)
