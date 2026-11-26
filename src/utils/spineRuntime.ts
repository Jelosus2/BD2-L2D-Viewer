import * as spine41 from '@esotericsoftware/spine-player'

export type SpineVersion = '4.1' | '4.2'

// Keep version-specific casts at this boundary. The viewer uses the common 4.1
// API; 4.2's physics argument and skeleton clock are handled explicitly below.
type RuntimeClasses = Pick<typeof spine41,
  'SpinePlayer' | 'Vector2' | 'CameraController' | 'OrthoCamera' | 'GLTexture' |
  'AnimationState' | 'AnimationStateData' | 'AssetManager' | 'AtlasAttachmentLoader' |
  'Skeleton' | 'SkeletonBinary' | 'MeshAttachment' | 'RegionAttachment' | 'Downloader'
>

export interface SpineRuntime {
  version: SpineVersion
  classes: RuntimeClasses
  updateWorldTransform(skeleton: spine41.Skeleton | null | undefined, resetPhysics?: boolean): void
  advanceSkeleton(skeleton: spine41.Skeleton, delta: number): void
  setSkeletonTime(skeleton: spine41.Skeleton, time: number): void
}

export function getSpineVersion(version: unknown): SpineVersion {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Missing or invalid Spine version in the skeleton header.')
  }
  const [major, minor] = version.split('.')
  const runtimeVersion = `${major}.${minor}`
  if (runtimeVersion !== '4.1' && runtimeVersion !== '4.2') {
    throw new Error(`Unsupported Spine version ${version}. Supported versions are 4.1 and 4.2.`)
  }
  return runtimeVersion
}

export function readBinarySpineVersion(bytes: Uint8Array): SpineVersion {
  // Spine 4.1/4.2 binaries start with an eight-byte hash, followed by a
  // varint byte count plus one and the UTF-8 version (no trailing terminator).
  let offset = 8
  let length = 0
  let shift = 0
  while (true) {
    if (offset >= bytes.length || shift > 28) throw new Error('Invalid Spine binary header.')
    const byte = bytes[offset++]
    length += (byte & 0x7f) * 2 ** shift
    if (!(byte & 0x80)) break
    shift += 7
  }
  if (length < 2 || length > bytes.length - offset + 1) {
    throw new Error('Invalid Spine binary version string.')
  }
  return getSpineVersion(new TextDecoder().decode(bytes.subarray(offset, offset + length - 1)))
}

export function readJsonSpineVersion(json: unknown): SpineVersion {
  const data = json as { skeleton?: { spine?: unknown } } | null
  return getSpineVersion(data?.skeleton?.spine)
}

export function createSkeletonDownloader(runtime: SpineRuntime, url: string, data: ArrayBuffer, json?: object) {
  const downloader = new runtime.classes.Downloader()
  // Feed the bytes used for version detection to the player without a second
  // network request. Atlas and texture requests keep the runtime's downloader.
  if (json) {
    const downloadJson = downloader.downloadJson.bind(downloader)
    downloader.downloadJson = (path, success, error) => {
      if (path === url) queueMicrotask(() => success(json))
      else downloadJson(path, success, error)
    }
  } else {
    const downloadBinary = downloader.downloadBinary.bind(downloader)
    downloader.downloadBinary = (path, success, error) => {
      if (path === url) queueMicrotask(() => success(new Uint8Array(data)))
      else downloadBinary(path, success, error)
    }
  }
  return downloader
}

export const spine41Runtime: SpineRuntime = {
  version: '4.1',
  classes: spine41,
  updateWorldTransform: skeleton => skeleton?.updateWorldTransform(),
  advanceSkeleton: () => {},
  setSkeletonTime: () => {},
}

let spine42Runtime: Promise<SpineRuntime> | undefined

export async function loadSpineRuntime(version: SpineVersion): Promise<SpineRuntime> {
  if (version === '4.1') return spine41Runtime
  spine42Runtime ??= import('@esotericsoftware/spine-player-4.2').then((spine42): SpineRuntime => ({
    version: '4.2',
    classes: spine42 as unknown as RuntimeClasses,
    updateWorldTransform(skeleton, resetPhysics = false) {
      const target = skeleton as unknown as InstanceType<typeof spine42.Skeleton> | null | undefined
      target?.updateWorldTransform(resetPhysics ? spine42.Physics.reset : spine42.Physics.update)
    },
    advanceSkeleton(skeleton, delta) {
      const target = skeleton as unknown as InstanceType<typeof spine42.Skeleton>
      target.update(delta)
    },
    setSkeletonTime(skeleton, time) {
      const target = skeleton as unknown as InstanceType<typeof spine42.Skeleton>
      target.time = time
    },
  })).catch(error => {
    spine42Runtime = undefined
    throw error
  })
  return spine42Runtime
}
