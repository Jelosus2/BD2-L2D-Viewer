import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import * as spine41 from '@esotericsoftware/spine-player'
import * as spine42 from '@esotericsoftware/spine-player-4.2'
import {
  createSkeletonDownloader,
  loadSpineRuntime,
  readBinarySpineVersion,
  readJsonSpineVersion,
} from '../src/utils/spineRuntime.ts'

function binaryHeader(version) {
  const text = Buffer.from(version)
  return Buffer.concat([Buffer.alloc(8), Buffer.from([text.length + 1]), text])
}

test('detects supported binary and JSON versions and rejects invalid headers', () => {
  for (const version of ['4.1.11', '4.2.43']) {
    const expected = version.slice(0, 3)
    assert.equal(readBinarySpineVersion(binaryHeader(version)), expected)
    assert.equal(readJsonSpineVersion({ skeleton: { spine: version } }), expected)
  }
  assert.throws(() => readBinarySpineVersion(binaryHeader('4.3.1')), /Unsupported Spine version/)
  assert.throws(() => readJsonSpineVersion({ skeleton: { spine: '3.8.99' } }), /Unsupported Spine version/)
  assert.throws(() => readJsonSpineVersion({}), /Missing or invalid/)
  for (const bytes of [Buffer.alloc(0), Buffer.alloc(8), Buffer.alloc(9), binaryHeader('4.2.43').subarray(0, 12), Buffer.alloc(16, 0xff)]) {
    assert.throws(() => readBinarySpineVersion(bytes), /Invalid Spine binary/)
  }
})

test('loads the existing 4.1 export with its matching runtime', async () => {
  const base = new URL('../src/assets/spines/000501/char000501', import.meta.url)
  const bytes = readFileSync(new URL(`${base.href}.skel`))
  const runtime = await loadSpineRuntime(readBinarySpineVersion(bytes))
  const atlas = new spine41.TextureAtlas(readFileSync(new URL(`${base.href}.atlas`), 'utf8'))
  for (const page of atlas.pages) {
    page.setTexture(new spine41.FakeTexture({ width: page.width, height: page.height }))
  }
  const data = new runtime.classes.SkeletonBinary(new runtime.classes.AtlasAttachmentLoader(atlas)).readSkeletonData(bytes)
  const skeleton = new runtime.classes.Skeleton(data)
  const state = new runtime.classes.AnimationState(new runtime.classes.AnimationStateData(data))
  state.setAnimation(0, 'idle', true)
  state.update(1 / 60)
  state.apply(skeleton)
  runtime.updateWorldTransform(skeleton)
  assert.equal(runtime.version, '4.1')
  assert.ok(skeleton instanceof spine41.Skeleton)
  assert.ok(skeleton.bones.every(bone => Number.isFinite(bone.worldX) && Number.isFinite(bone.worldY)))
})

test('keeps the 4.2 core separate and advances physics during manual rendering', async () => {
  const runtime = await loadSpineRuntime('4.2')
  assert.notEqual(spine41.Skeleton, spine42.Skeleton)
  const loader = new spine42.SkeletonJson(new spine42.AtlasAttachmentLoader(new spine42.TextureAtlas('')))
  const data = loader.readSkeletonData({
    skeleton: { spine: '4.2.43' },
    bones: [{ name: 'root' }],
    physics: [{
      name: 'physics', bone: 'root', x: 1, y: 1, fps: 60, limit: 500,
      inertia: 1, strength: 100, damping: 0.7, mass: 1, gravity: 1, mix: 1,
    }],
  })
  const skeleton = new runtime.classes.Skeleton(data)
  runtime.updateWorldTransform(skeleton, true)
  for (let frame = 0; frame < 60; frame++) {
    skeleton.x += 1
    runtime.advanceSkeleton(skeleton, 1 / 60)
    runtime.updateWorldTransform(skeleton)
  }
  assert.ok(skeleton instanceof spine42.Skeleton)
  assert.ok(Math.abs(skeleton.time - 1) < 1e-6)
  assert.ok(Number.isFinite(skeleton.bones[0].worldX))
  assert.ok(Number.isFinite(skeleton.bones[0].worldY))
  assert.notEqual(skeleton.physicsConstraints[0].yOffset, 0)
  runtime.setSkeletonTime(skeleton, 0)
  runtime.updateWorldTransform(skeleton, true)
  assert.equal(skeleton.time, 0)
})

test('reuses preloaded binary and JSON data with either downloader', async () => {
  for (const version of ['4.1', '4.2']) {
    const runtime = await loadSpineRuntime(version)
    const bytes = Uint8Array.from(binaryHeader(`${version}.1`))
    const binary = createSkeletonDownloader(runtime, 'model.skel', bytes.buffer)
    const result = await new Promise((resolve, reject) => binary.downloadBinary('model.skel', resolve, reject))
    assert.deepEqual(result, bytes)
    const json = { skeleton: { spine: `${version}.1` }, bones: [{ name: 'root' }] }
    const downloader = createSkeletonDownloader(runtime, 'upload.json', new ArrayBuffer(0), json)
    assert.equal(await new Promise((resolve, reject) => downloader.downloadJson('upload.json', resolve, reject)), json)
  }
})
