import { readFileSync, writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

// Historical visual-reference source. All content is explicitly fictitious demo content.
const dir = dirname(fileURLToPath(import.meta.url))
const esc = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const rect = (x, y, w, h, fill, r = 0, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`
const txt = (x, y, value, size = 20, color = '#17343B', weight = 400, extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-family="Noto Sans SC, PingFang SC, Arial, sans-serif" font-size="${size}" font-weight="${weight}" ${extra}>${esc(value)}</text>`
const line = (x1, y1, x2, y2, color, width = 1) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${color}" stroke-width="${width}"/>`
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`

const configs = {
  beach: {
    name: '海边沙滩', file: 'beach-environment-v1.png', ink: '#153A45', muted: '#49656B', canvas: '#FBF7EE', surface: '#FFFFFF', primary: '#087E8B', pale: '#F2FCFB', accent: '#E88E69', border: '#D8E5E1', dark: '#0C2931',
    eyebrow: 'LeYou • Growing Moments', hero: '把有海风的日子，留在这里。', sub: '照片、视频与那些值得重看的片刻。', footer: '潮线只作陪衬 · 回忆始终是主角',
    chip: '海边主题', alt: '沙滩、海浪、椰树与贝壳的装饰性插画',
  },
  grassland: {
    name: '旷野草原', file: 'grassland-environment-v1.png', ink: '#253A36', muted: '#5A6B62', canvas: '#F7F8F0', surface: '#FFFFFF', primary: '#3D765C', pale: '#E4F0E2', accent: '#D8A852', border: '#DCE7D9', dark: '#1B322D',
    eyebrow: '沿着风走过的路', hero: '把开阔的日子，留在这里。', sub: '照片、视频与那些值得重看的片刻。', footer: '地平线只作陪衬 · 回忆始终是主角',
    chip: '草原主题', alt: '草地、远山、云、树与野花的装饰性插画',
  },
}

function screen(c, title, body) {
  return `${rect(0, 0, 1440, 900, c.canvas, 24)}${body}${rect(0, 0, 1440, 900, 'none', 24, `stroke="${c.border}" stroke-width="2"`)}`
}
function nav(c, dark = false) {
  const ink = dark ? '#FFFFFF' : c.ink
  return `${rect(0, 0, 1440, 80, dark ? '#132D35E6' : '#FFFFFFEB')}${txt(56, 51, '留影 · FAMILY ARCHIVE', 23, ink, 700)}${txt(920, 49, '首页', 16, ink, 600)}${txt(1005, 49, '全部影像', 16, ink)}${txt(1118, 49, '相册', 16, ink)}${rect(1224, 18, 166, 44, dark ? '#FFFFFF20' : c.pale, 22, `stroke="${dark ? '#FFFFFF66' : c.border}"`)}${txt(1245, 47, `◐  ${c.chip}  ⌄`, 15, ink, 600)}`
}
function mediaTile(c, x, y, w, h, label, type = 'photo', n = 0) {
  const gradients = [
    ['#A6CED0', '#E8CDB0'], ['#97B5A3', '#E9D7BA'], ['#D6B6A3', '#C2D9D3'], ['#ADBFC6', '#D8C9AD'],
  ]
  const [a, b] = gradients[n % gradients.length]
  return `<defs><linearGradient id="tile-${x}-${y}" x2="1" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>${rect(x, y, w, h, `url(#tile-${x}-${y})`, 16)}${rect(x + 12, y + 12, 64, 26, '#FFFFFFE8', 13)}${txt(x + 23, y + 31, '演示素材', 12, c.ink, 600)}${type === 'video' ? `${circle(x+w-32,y+32,18,'#FFFFFFE8')}${txt(x+w-37,y+38,'▶',14,c.ink,700)}` : ''}${rect(x, y+h-57, w, 57, '#102B35AA', 0)}${txt(x+18,y+h-23,label,16,'#FFFFFF',600)}`
}
function home(c, img) {
  return screen(c, '首页', `
    <defs><clipPath id="homeHero"><rect x="0" y="80" width="1440" height="456"/></clipPath></defs>
    <g clip-path="url(#homeHero)"><image href="${img}" x="0" y="80" width="1440" height="456" preserveAspectRatio="xMidYMid slice"/></g>
    ${rect(0,80,1440,456,'#14384320')}${nav(c)}
    ${rect(56,126,650,340,'#FFFDF4E9',24,`stroke="${c.border}"`)}
    ${rect(88,158,184,30,c.pale,15)}${txt(106,179,c.eyebrow,14,c.primary,700)}
    ${txt(88,246,c.hero,38,c.ink,700)}${txt(88,290,c.sub,19,c.muted)}
    ${rect(88,326,180,52,c.primary,16)}${txt(123,360,'浏览全部影像  →',17,'#FFFFFF',700)}
    ${rect(280,326,150,52,'#FFFFFF',16,`stroke="${c.border}"`)}${txt(316,360,'继续播放  ▶',17,c.ink,600)}
    ${txt(88,421,'28 个片刻 · 6 本相册 · 内容均为演示',15,c.muted)}
    ${txt(56,589,'最近留下的片刻',26,c.ink,700)}${txt(1232,587,'查看全部  →',16,c.primary,600)}
    ${mediaTile(c,56,618,420,208,'午后的海风 / 远方的风', 'photo', 0)}
    ${mediaTile(c,510,618,420,208,'沿途的小片段', 'video', 1)}
    ${mediaTile(c,964,618,420,208,'一起走过的路', 'photo', 2)}
    ${txt(56,865,c.footer,13,c.muted)}${txt(1234,865,'示例内容 · 非真实影像',13,c.muted)}
  `)
}
function browse(c, img) {
  return screen(c, '浏览', `
    <defs><clipPath id="browseHero"><rect x="0" y="80" width="1440" height="208"/></clipPath></defs>
    <g clip-path="url(#browseHero)"><image href="${img}" x="0" y="80" width="1440" height="208" preserveAspectRatio="xMidYMid slice"/></g>
    ${rect(0,80,1440,208,'#173A4080')}${nav(c)}
    ${txt(56,166,'全部影像',35,'#FFFFFF',700)}${txt(56,207,'沿着时间，慢慢翻看。',18,'#FFFFFF')}
    ${rect(56,245,434,44,'#FFFFFFE8',22)}${txt(78,273,'全部  28',15,c.ink,700)}${txt(205,273,'照片  21',15,c.muted)}${txt(339,273,'视频  7',15,c.muted)}
    ${rect(56,324,212,508,c.surface,18,`stroke="${c.border}"`)}${txt(79,365,'按时间定位',18,c.ink,700)}
    ${rect(74,390,176,40,c.pale,12)}${txt(95,417,'2026  ·  12 项',15,c.primary,700)}
    ${txt(96,467,'2025  ·  10 项',15,c.muted)}${txt(96,517,'2024  ·  6 项',15,c.muted)}
    ${line(78,549,246,549,c.border)}${txt(79,586,'相册',16,c.ink,700)}
    ${txt(96,628,'夏日片段',15,c.muted)}${txt(96,668,'周末路上',15,c.muted)}${txt(96,708,'平常日子',15,c.muted)}
    ${txt(302,357,'2026 年',24,c.ink,700)}${txt(1268,355,'最新优先  ⌄',15,c.muted)}
    ${mediaTile(c,302,385,335,199,'午后的光', 'photo', 0)}
    ${mediaTile(c,655,385,335,199,'这段路', 'video', 1)}
    ${mediaTile(c,1008,385,335,199,'远处的云', 'photo', 2)}
    ${mediaTile(c,302,605,335,199,'回家的傍晚', 'photo', 3)}
    ${mediaTile(c,655,605,335,199,'路过的风景', 'photo', 0)}
    ${mediaTile(c,1008,605,335,199,'一小段回忆', 'video', 1)}
    ${txt(302,858,'键盘可用方向键在网格中移动焦点；滚动时年份导航保持可见。',13,c.muted)}
  `)
}
function detail(c) {
  return screen(c, '相册详情', `
    ${nav(c)}${txt(56,119,'首页  /  全部影像  /  夏日片段',14,c.muted)}
    ${txt(56,182,'夏日片段',38,c.ink,700)}${txt(56,221,'2026.07 — 2026.08    ·    12 项影像    ·    演示相册',17,c.muted)}
    ${txt(56,258,'风吹过的午后，和一些舍不得忘记的小事。',18,c.muted)}
    ${rect(1187,162,196,50,c.primary,15)}${txt(1215,195,'▶  从这里播放',16,'#FFFFFF',700)}
    ${mediaTile(c,56,298,640,322,'从海岸 / 山坡出发', 'photo', 0)}
    ${mediaTile(c,714,298,322,322,'午后的一分钟', 'video', 1)}
    ${mediaTile(c,1054,298,330,322,'路边的花', 'photo', 2)}
    ${txt(56,681,'接下来的影像',23,c.ink,700)}${txt(1180,679,'下一本相册  →',16,c.primary,600)}
    ${mediaTile(c,56,707,317,148,'远处的天光', 'photo', 3)}
    ${mediaTile(c,391,707,317,148,'走走停停', 'photo', 0)}
    ${mediaTile(c,726,707,317,148,'短短一段路', 'video', 1)}
    ${mediaTile(c,1061,707,323,148,'回家的方向', 'photo', 2)}
  `)
}
function viewer(c) {
  return screen(c, '媒体查看器', `
    ${rect(0,0,1440,900,'#091C23')}${rect(0,0,1440,86,'#04161CCF')}
    ${txt(54,52,'←  返回夏日片段',17,'#FFFFFF',600)}${txt(659,52,'3 / 12',17,'#FFFFFF',600)}${txt(1290,52,'关闭  ✕',17,'#FFFFFF',600)}
    ${rect(150,116,1140,598,'#162F36',16)}
    <defs><linearGradient id="viewerPoster" x2="1" y2="1"><stop stop-color="#708F91"/><stop offset="0.6" stop-color="#C2C4AC"/><stop offset="1" stop-color="#D7A886"/></linearGradient></defs>
    ${rect(166,132,1108,566,'url(#viewerPoster)',10)}
    ${txt(551,403,'演示媒体占位',36,'#FFFFFF',700)}${txt(510,448,'实际图片 / 视频保持原始比例显示',19,'#FFFFFF')}
    ${circle(85,411,30,'#FFFFFF26')}${txt(74,420,'‹',34,'#FFFFFF')}${circle(1355,411,30,'#FFFFFF26')}${txt(1345,420,'›',34,'#FFFFFF')}
    ${rect(40,738,1360,121,'#18343CEB',18)}
    ${txt(66,778,'▶',24,'#FFFFFF',700)}${txt(114,778,'00:28 / 01:42',15,'#FFFFFF')}
    ${rect(278,761,786,6,'#FFFFFF50',3)}${rect(278,761,222,6,c.accent,3)}${circle(500,764,8,'#FFFFFF')}
    ${txt(1090,779,'音量  ◖))',15,'#FFFFFF')}${txt(1230,779,'全屏  ⛶',15,'#FFFFFF')}
    ${txt(66,827,'连续播放  开',15,'#FFFFFF')}${txt(245,827,'上一项',15,'#FFFFFF')}${txt(345,827,'下一项',15,'#FFFFFF')}
    ${txt(662,826,'鼠标移动 / 点按显示控制栏 · 3 秒无操作隐藏',14,'#C8DADC')}
    ${txt(70,886,'←/→ 上一项/下一项   Space 播放/暂停   Esc 退出   双击/双指缩放图片',13,'#A9C2C6')}
  `)
}
function mobile(c, img) {
  const content = `${rect(0,0,390,844,c.canvas,30)}
    <defs><clipPath id="mobileHero"><rect x="0" y="66" width="390" height="286"/></clipPath></defs>
    <g clip-path="url(#mobileHero)"><image href="${img}" x="0" y="66" width="390" height="286" preserveAspectRatio="xMidYMid slice"/></g>
    ${rect(0,0,390,66,'#FFFFFFED')}${txt(21,43,'留影',22,c.ink,700)}${txt(326,42,'☰',24,c.ink,700)}
    ${rect(16,146,358,181,'#FFFDF3E8',18)}${txt(34,185,c.eyebrow,13,c.primary,700)}
    ${txt(34,219,'把日子留在这里。',23,c.ink,700)}${txt(34,247,'照片、视频与值得重看的片刻。',14,c.muted)}
    ${rect(34,266,145,44,c.primary,13)}${txt(54,294,'浏览全部影像  →',13,'#FFFFFF',700)}
    ${txt(18,394,'最近留下的片刻',21,c.ink,700)}${txt(310,392,'查看全部  →',12,c.primary,600)}
    ${mediaTile(c,18,414,354,180,'午后的光', 'photo', 0)}
    ${mediaTile(c,18,612,170,142,'沿途一段', 'video', 1)}
    ${mediaTile(c,202,612,170,142,'回家的路', 'photo', 2)}
    ${rect(0,785,390,59,'#FFFFFF',0,`stroke="${c.border}"`)}
    ${txt(42,820,'⌂  首页',13,c.primary,700)}${txt(164,820,'▦  影像',13,c.muted)}${txt(287,820,'▣  相册',13,c.muted)}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" role="img" aria-label="${c.name}移动端首页，所有媒体均为演示内容">${content}</svg>`
}

function mobileShell(c, active, body) {
  const item = (x, icon, label, key) => txt(x, 818, `${icon}  ${label}`, 13, key === active ? c.primary : c.muted, key === active ? 700 : 500)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" role="img" aria-label="${c.name}移动端${active}页，媒体均为演示内容">${rect(0, 0, 390, 844, c.canvas)}${rect(0, 0, 390, 66, '#FFFFFFF2')}${txt(18, 43, '留影', 22, c.ink, 700)}${txt(281, 42, '◐', 19, c.primary, 700)}${txt(346, 42, '☰', 22, c.ink, 700)}${body}${rect(0, 785, 390, 59, '#FFFFFF', 0, `stroke="${c.border}"`)}${item(32, '⌂', '首页', '首页')}${item(153, '▦', '影像', '影像')}${item(274, '▣', '相册', '相册')}</svg>`
}

function mobileBrowse(c, img) {
  return mobileShell(c, '影像', `<defs><clipPath id="browse-mobile-hero"><rect x="0" y="66" width="390" height="156"/></clipPath></defs><g clip-path="url(#browse-mobile-hero)"><image href="${img}" x="0" y="66" width="390" height="156" preserveAspectRatio="xMidYMid slice"/></g>${rect(0,66,390,156,'#173A4066')}${txt(18,137,'全部影像',27,'#FFFFFF',700)}${txt(18,169,'沿着时间，慢慢翻看。',14,'#FFFFFF')}${rect(18,238,354,46,'#FFFFFF',13,`stroke="${c.border}"`)}${txt(35,268,'全部  28',14,c.primary,700)}${txt(153,268,'照片  21',14,c.muted)}${txt(271,268,'视频  7',14,c.muted)}${rect(18,298,354,43,c.pale,12)}${txt(35,326,'2026 年  ▾',15,c.ink,700)}${txt(292,326,'筛选  ⚑',14,c.primary,700)}${txt(18,376,'2026 年 · 12 项',18,c.ink,700)}${mediaTile(c,18,393,170,161,'午后的光','photo',0)}${mediaTile(c,202,393,170,161,'这段路','video',1)}${mediaTile(c,18,568,170,161,'远处的云','photo',2)}${mediaTile(c,202,568,170,161,'回家的傍晚','photo',3)}${txt(18,759,'滚动分组 · 年份定位保留在顶部',12,c.muted)}`)
}

function mobileAlbum(c) {
  return mobileShell(c, '相册', `${txt(18,94,'‹  全部影像 / 夏日片段',13,c.muted)}${txt(18,143,'夏日片段',28,c.ink,700)}${txt(18,172,'2026.07—08 · 12 项 · 演示相册',13,c.muted)}${txt(18,199,'风吹过的午后，和舍不得忘记的小事。',14,c.muted)}${rect(18,218,354,48,c.primary,13)}${txt(120,249,'▶  从这里播放',16,'#FFFFFF',700)}${mediaTile(c,18,285,354,214,'从海岸 / 山坡出发','photo',0)}${mediaTile(c,18,513,170,166,'午后的一分钟','video',1)}${mediaTile(c,202,513,170,166,'路边的花','photo',2)}${txt(18,720,'下一本相册',17,c.ink,700)}${txt(264,720,'周末路上  →',13,c.primary,700)}${txt(18,758,'媒体打开后，关闭应返回当前相册与位置。',12,c.muted)}`)
}

function mobileViewer(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844" viewBox="0 0 390 844" role="img" aria-label="${c.name}移动端媒体查看器，媒体为演示占位内容">${rect(0,0,390,844,'#091C23')}${rect(0,0,390,76,'#04161CEB')}${txt(18,43,'‹  夏日片段',14,'#FFFFFF',600)}${txt(176,43,'3 / 12',14,'#FFFFFF',600)}${txt(341,43,'✕',20,'#FFFFFF')}${rect(18,148,354,475,'#18343C',14)}<defs><linearGradient id="mobile-viewer-poster" x2="1" y2="1"><stop stop-color="#708F91"/><stop offset="0.6" stop-color="#C2C4AC"/><stop offset="1" stop-color="#D7A886"/></linearGradient></defs>${rect(27,157,336,457,'url(#mobile-viewer-poster)',9)}${txt(92,374,'演示媒体占位',24,'#FFFFFF',700)}${txt(97,405,'纵向媒体完整显示',15,'#FFFFFF')}${circle(35,646,20,'#FFFFFF26')}${txt(28,653,'‹',25,'#FFFFFF')}${circle(355,646,20,'#FFFFFF26')}${txt(348,653,'›',25,'#FFFFFF')}${rect(0,685,390,159,'#18343CF2')}${txt(20,719,'▶',21,'#FFFFFF',700)}${txt(69,718,'00:28 / 01:42',13,'#FFFFFF')}${rect(20,739,350,5,'#FFFFFF55',2)}${rect(20,739,104,5,c.accent,2)}${circle(124,741,7,'#FFFFFF')}${txt(20,774,'连续播放  开',13,'#FFFFFF')}${txt(217,774,'音量',13,'#FFFFFF')}${txt(328,774,'⛶',19,'#FFFFFF')}${txt(20,814,'轻触显隐控件 · 左右滑动切换 · 返回退出',12,'#B8CFD2')}</svg>`
}

for (const [key, c] of Object.entries(configs)) {
  const img = `data:image/png;base64,${readFileSync(join(dir, c.file)).toString('base64')}`
  const positions = [[80,80,home(c,img)],[1640,80,browse(c,img)],[80,1050,detail(c)],[1640,1050,viewer(c)]]
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="3160" height="2030" viewBox="0 0 3160 2030" role="img" aria-label="${c.name}桌面端首页、浏览、相册详情和媒体查看器设计"><rect width="3160" height="2030" fill="#E9EFEC"/>${positions.map(([x,y,markup])=>`<g transform="translate(${x} ${y})">${markup}</g>`).join('')}${txt(80,42,`${c.name} · 桌面端核心页面 · 1440 × 900 · 演示内容`,18,c.ink,700)}</svg>`
  writeFileSync(join(dir, `${key}-screens-v2.svg`), full)
  writeFileSync(join(dir, `${key}-mobile-v2.svg`), mobile(c,img))
  const fullPng = join(dir, `${key}-screens-v2.png`)
  await sharp(Buffer.from(full)).png().toFile(fullPng)
  await sharp(Buffer.from(mobile(c,img))).png().toFile(join(dir, `${key}-mobile-v2.png`))
  for (const [name, markup] of [['browse',mobileBrowse(c,img)],['album',mobileAlbum(c)],['viewer',mobileViewer(c)]]) {
    writeFileSync(join(dir, `${key}-${name}-mobile-v3.svg`), markup)
    await sharp(Buffer.from(markup)).png().toFile(join(dir, `${key}-${name}-mobile-v3.png`))
  }
  for (const [name, x, y] of [['home',80,80],['browse',1640,80],['album',80,1050],['viewer',1640,1050]]) {
    await sharp(fullPng).extract({ left:x, top:y, width:1440, height:900 }).png().toFile(join(dir, `${key}-${name}-v2.png`))
  }
}
