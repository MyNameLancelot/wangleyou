import type { Album, Media, Photo, SiteContent, Video } from './model'

/** 单张照片寄语的长度上限：查看器里只作一行文案，超过就会挤压影像。 */
export const CAPTION_MAX_LENGTH = 60

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const PERIOD_PATTERN = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i

type UnknownRecord = Record<string, unknown>

function fail(location: string, message: string): never {
  throw new Error(`${location}: ${message}`)
}

function assertRecord(value: unknown, location: string): asserts value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(location, 'must be an object')
  }
}

function assertString(value: unknown, location: string, nonEmpty = false): asserts value is string {
  if (typeof value !== 'string') {
    fail(location, 'must be a string')
  }
  if (nonEmpty && value.trim().length === 0) {
    fail(location, 'must not be empty')
  }
}

function assertOptionalString(value: unknown, location: string): asserts value is string | undefined {
  if (value !== undefined && typeof value !== 'string') {
    fail(location, 'must be a string when provided')
  }
}

function assertId(value: unknown, location: string): asserts value is string {
  assertString(value, location)
  if (!ID_PATTERN.test(value)) {
    fail(location, 'must contain only lowercase letters, numbers, and single hyphen separators')
  }
}

function assertDate(value: unknown, location: string): asserts value is string | undefined {
  if (value === undefined) return
  assertString(value, location)
  const match = DATE_PATTERN.exec(value)
  if (!match) fail(location, 'must use YYYY-MM-DD')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    fail(location, 'must be a real calendar date')
  }
}

/** 相册表示一段日子，允许只写到月：`YYYY-MM` 或 `YYYY-MM-DD`。 */
function assertPeriod(value: unknown, location: string): asserts value is string | undefined {
  if (value === undefined) return
  assertString(value, location)
  const match = PERIOD_PATTERN.exec(value)
  if (!match) fail(location, 'must use YYYY-MM or YYYY-MM-DD')
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) fail(location, 'must be a real calendar month')
  if (match[3] === undefined) return
  const day = Number(match[3])
  const candidate = new Date(Date.UTC(year, month - 1, day))
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) {
    fail(location, 'must be a real calendar date')
  }
}

function decodeAssetPath(path: string, location: string): string {
  let decoded = path
  for (let pass = 0; pass < 10; pass += 1) {
    let next: string
    try {
      next = decodeURIComponent(decoded)
    } catch {
      fail(location, 'contains invalid percent encoding')
    }
    if (next === decoded) return decoded
    decoded = next
  }
  fail(location, 'contains excessive nested percent encoding')
}

export function assertAssetPath(path: unknown, location: string): asserts path is string {
  assertString(path, location, true)
  const decoded = decodeAssetPath(path, location)

  if (URL_SCHEME_PATTERN.test(decoded)) fail(location, 'must not contain a URL protocol')
  if (decoded.startsWith('/') || decoded.startsWith('\\')) fail(location, 'must be relative')
  if (decoded.includes('\\')) fail(location, 'must use forward slashes')
  if (decoded.includes('?') || decoded.includes('#')) fail(location, 'must not contain a query or fragment')
  if (/\p{Cc}/u.test(decoded)) fail(location, 'must not contain control characters')

  const segments = decoded.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    fail(location, 'must not contain empty, current-directory, or parent-directory segments')
  }
}

function assertOptionalAssetPath(value: unknown, location: string): asserts value is string | undefined {
  if (value !== undefined) assertAssetPath(value, location)
}

function assertOptionalPositiveInteger(value: unknown, location: string): asserts value is number | undefined {
  if (value !== undefined && (!Number.isInteger(value) || (value as number) <= 0)) {
    fail(location, 'must be a positive integer when provided')
  }
}

function assertOptionalDuration(value: unknown, location: string): asserts value is number | undefined {
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
    fail(location, 'must be a non-negative finite number when provided')
  }
}

function validateCommonMedia(input: UnknownRecord, location: string): void {
  assertId(input.id, `${location}.id`)
  assertAssetPath(input.src, `${location}.src`)
  assertDate(input.date, `${location}.date`)
  assertOptionalString(input.caption, `${location}.caption`)
  if (typeof input.caption === 'string' && (input.caption.trim().length === 0 || [...input.caption.trim()].length > CAPTION_MAX_LENGTH)) {
    fail(`${location}.caption`, `must contain 1 to ${CAPTION_MAX_LENGTH} non-whitespace characters`)
  }
  assertOptionalString(input.description, `${location}.description`)
  assertOptionalString(input.alt, `${location}.alt`)
  assertOptionalPositiveInteger(input.width, `${location}.width`)
  assertOptionalPositiveInteger(input.height, `${location}.height`)
  if (input.srcSet !== undefined) {
    if (!Array.isArray(input.srcSet) || input.srcSet.length === 0) fail(`${location}.srcSet`, 'must be a non-empty array when provided')
    const width = input.width
    const height = input.height
    input.srcSet.forEach((candidate, index) => {
      const candidateLocation = `${location}.srcSet[${index}]`
      assertRecord(candidate, candidateLocation)
      assertAssetPath(candidate.src, `${candidateLocation}.src`)
      assertOptionalPositiveInteger(candidate.width, `${candidateLocation}.width`)
      assertOptionalPositiveInteger(candidate.height, `${candidateLocation}.height`)
      if (!candidate.width || !candidate.height) fail(candidateLocation, 'must include width and height')
      if (width && height && Math.abs(candidate.width / candidate.height - width / height) > 0.002) fail(candidateLocation, 'must preserve the source aspect ratio')
    })
  }
}

function validateMedia(input: unknown, location: string): Media {
  assertRecord(input, location)
  validateCommonMedia(input, location)

  if (input.type === 'photo') {
    return input as unknown as Photo
  }
  if (input.type === 'video') {
    assertOptionalAssetPath(input.poster, `${location}.poster`)
    assertOptionalAssetPath(input.captions, `${location}.captions`)
    assertOptionalDuration(input.duration, `${location}.duration`)
    return input as unknown as Video
  }
  fail(`${location}.type`, "must be 'photo' or 'video'")
}

function validateAlbum(input: unknown, location: string): Album {
  assertRecord(input, location)
  assertId(input.id, `${location}.id`)
  assertString(input.title, `${location}.title`, true)
  assertOptionalString(input.description, `${location}.description`)
  assertOptionalString(input.opening, `${location}.opening`)
  if (typeof input.opening === 'string' && (input.opening.trim().length === 0 || [...input.opening.trim()].length > 20)) {
    fail(`${location}.opening`, 'must contain 1 to 20 non-whitespace characters')
  }
  assertPeriod(input.date, `${location}.date`)
  assertOptionalAssetPath(input.cover, `${location}.cover`)
  if (!Array.isArray(input.media)) fail(`${location}.media`, 'must be an array')

  const mediaIds = new Set<string>()
  input.media.forEach((item, index) => {
    const itemLocation = `${location}.media[${index}]`
    const media = validateMedia(item, itemLocation)
    if (mediaIds.has(media.id)) fail(`${itemLocation}.id`, `duplicates media id '${media.id}' in this album`)
    mediaIds.add(media.id)
  })
  return input as unknown as Album
}

export function validateContent(input: unknown): SiteContent {
  assertRecord(input, 'content')
  assertRecord(input.site, 'site')
  assertString(input.site.title, 'site.title', true)
  assertString(input.site.subtitle, 'site.subtitle')
  if (!Array.isArray(input.albums)) fail('albums', 'must be an array')

  const albumIds = new Set<string>()
  input.albums.forEach((item, index) => {
    const location = `albums[${index}]`
    const album = validateAlbum(item, location)
    if (albumIds.has(album.id)) fail(`${location}.id`, `duplicates album id '${album.id}'`)
    albumIds.add(album.id)
  })
  return input as unknown as SiteContent
}

export function validateHomeMemory(input: unknown): Photo[] {
  if (!Array.isArray(input)) fail('home-memory', 'must be an array')
  const ids = new Set<string>()
  return input.map((item, index) => {
    const photo = validateMedia(item, `home-memory[${index}]`)
    if (photo.type !== 'photo') fail(`home-memory[${index}].type`, 'must be photo')
    if (ids.has(photo.id)) fail(`home-memory[${index}].id`, `duplicates photo id '${photo.id}'`)
    ids.add(photo.id)
    return photo
  })
}
