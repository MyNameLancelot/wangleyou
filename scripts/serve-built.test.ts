import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtemp, mkdir, open, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it } from 'vitest'

const temporary: string[] = []
const children: ChildProcess[] = []
afterEach(async () => {
  await Promise.all(children.splice(0).map(child => new Promise<void>(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return }
    child.once('exit', () => resolve())
    child.kill()
  })))
  await Promise.all(temporary.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

async function server(base = '/wangleyou/') {
  const root = await mkdtemp(join(tmpdir(), 'wangleyou-static-'))
  temporary.push(root)
  await mkdir(join(root, 'dist'))
  await writeFile(join(root, 'dist/index.html'), 'home')
  await writeFile(join(root, 'dist/video.mp4'), '0123456789')
  await writeFile(join(root, 'dist/empty.mp4'), '')
  await writeFile(join(root, 'private.txt'), 'private')
  await symlink(join(root, 'private.txt'), join(root, 'dist/link.txt'))
  const file = await open(join(root, 'dist/large.mp4'), 'w')
  await file.truncate(100 * 1024 * 1024)
  await file.close()
  const child = spawn(process.execPath, [fileURLToPath(new URL('./serve-built.mjs', import.meta.url))], {
    cwd: root, env: { ...process.env, PORT: '0', SITE_BASE: base }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)
  const url = await new Promise<string>((resolve, reject) => {
    let output = ''
    child.once('error', reject)
    child.once('exit', code => reject(new Error(`static server exited: ${code}`)))
    child.stdout!.on('data', data => {
      output += String(data)
      const match = /Strict static preview: (http:\/\/[^\s]+)/.exec(output)
      if (match) resolve(match[1])
    })
    child.stderr!.on('data', data => reject(new Error(String(data))))
  })
  return url
}

it.each(['/wangleyou/', '/'])('serves the requested base with unchanged GET/HEAD headers: %s', async base => {
  const url = await server(base)
  expect(await (await fetch(url)).text()).toBe('home')
  const head = await fetch(`${url}video.mp4`, { method: 'HEAD' })
  expect(head.status).toBe(200)
  expect(head.headers.get('content-type')).toBe('video/mp4')
  expect(head.headers.get('content-length')).toBe('10')
  expect(head.headers.get('accept-ranges')).toBe('bytes')
  expect(head.headers.get('cache-control')).toBe('no-store')
  expect(await head.text()).toBe('')
})

it('supports bounded, open-ended, suffix and HEAD ranges; rejects invalid and empty ranges', async () => {
  const url = await server()
  for (const [range, body, contentRange] of [
    ['bytes=2-4', '234', 'bytes 2-4/10'], ['bytes=7-', '789', 'bytes 7-9/10'],
    ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-999', '89', 'bytes 8-9/10'],
  ]) {
    const response = await fetch(`${url}video.mp4`, { headers: { Range: range } })
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe(contentRange)
    expect(response.headers.get('content-length')).toBe(String(body.length))
    expect(await response.text()).toBe(body)
  }
  const head = await fetch(`${url}video.mp4`, { method: 'HEAD', headers: { Range: 'bytes=2-4' } })
  expect(head.status).toBe(206)
  expect(head.headers.get('content-length')).toBe('3')
  expect(await head.text()).toBe('')
  for (const range of ['bytes=10-', 'bytes=4-2', 'bytes=-0', 'bytes=0-1,3-4', 'bytes=-']) {
    const response = await fetch(`${url}video.mp4`, { headers: { Range: range } })
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */10')
  }
  expect((await fetch(`${url}empty.mp4`, { headers: { Range: 'bytes=0-' } })).status).toBe(416)
  expect(await (await fetch(`${url}empty.mp4`)).text()).toBe('')
})

it('confines files by realpath and rejects traversal, invalid encoding and non-read methods', async () => {
  const url = await server()
  for (const path of ['link.txt', '%2e%2e%2fprivate.txt', '%2Fprivate.txt', '%ZZ', 'missing']) {
    expect((await fetch(`${url}${path}`)).status).toBe(404)
  }
  expect((await fetch(url, { method: 'POST' })).status).toBe(404)
  expect((await fetch(new URL('/index.html', url))).status).toBe(404)
})

it('serves HEAD and 32-byte ranges from a 100MiB file and survives aborted streaming', async () => {
  const url = await server()
  const head = await fetch(`${url}large.mp4`, { method: 'HEAD' })
  expect(head.headers.get('content-length')).toBe(String(100 * 1024 * 1024))
  expect(await head.text()).toBe('')
  const range = await fetch(`${url}large.mp4`, { headers: { Range: 'bytes=100-131' } })
  expect(range.status).toBe(206)
  expect((await range.arrayBuffer()).byteLength).toBe(32)
  const response = await fetch(`${url}large.mp4`)
  await response.body!.cancel()
  expect(await (await fetch(url)).text()).toBe('home')
})
