/**
 * 娃娃机与玩偶数据定义
 * 6个不同类型的娃娃机，每个机子6种玩偶（5内置SVG生成 + 1自定义上传白底图抠像）
 */

// ============================================================
// SVG 玩偶贴图生成器
// ============================================================

/** 主体形状 SVG 路径生成 */
function bodyShape(type, cx, cy, r, color) {
    const shapes = {
        circle: `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`,
        rounded: `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" rx="${r * 0.35}" fill="${color}"/>`,
        star: `<polygon points="${starPoints(cx, cy, r, 5)}" fill="${color}"/>`,
        heart: `<path d="M${cx} ${cy + r * 0.7} C${cx - r * 1.2} ${cy - r * 0.2} ${cx - r * 0.6} ${cy - r} ${cx} ${cy - r * 0.3} C${cx + r * 0.6} ${cy - r} ${cx + r * 1.2} ${cy - r * 0.2} ${cx} ${cy + r * 0.7} Z" fill="${color}"/>`,
        drop: `<path d="M${cx} ${cy - r} Q${cx + r} ${cy} ${cx} ${cy + r} Q${cx - r} ${cy} ${cx} ${cy - r} Z" fill="${color}"/>`,
        hexagon: `<polygon points="${hexPoints(cx, cy, r)}" fill="${color}"/>`,
        cloud: `<g fill="${color}"><circle cx="${cx - r * 0.5}" cy="${cy}" r="${r * 0.5}"/><circle cx="${cx + r * 0.5}" cy="${cy}" r="${r * 0.5}"/><circle cx="${cx}" cy="${cy - r * 0.3}" r="${r * 0.6}"/><rect x="${cx - r * 0.7}" y="${cy}" width="${r * 1.4}" height="${r * 0.5}" rx="${r * 0.2}"/></g>`,
        mushroom: `<g fill="${color}"><path d="M${cx - r} ${cy} Q${cx} ${cy - r * 1.3} ${cx + r} ${cy} Z"/><rect x="${cx - r * 0.4}" y="${cy}" width="${r * 0.8}" height="${r * 0.7}" rx="${r * 0.1}" fill="#FFF5E6"/></g>`,
        ghost: `<path d="M${cx - r} ${cy + r} L${cx - r} ${cy - r * 0.3} Q${cx - r} ${cy - r} ${cx} ${cy - r} Q${cx + r} ${cy - r} ${cx + r} ${cy - r * 0.3} L${cx + r} ${cy + r} L${cx + r * 0.5} ${cy + r * 0.7} L${cx} ${cy + r} L${cx - r * 0.5} ${cy + r * 0.7} Z" fill="${color}"/>`,
        slime: `<path d="M${cx - r} ${cy + r * 0.5} Q${cx - r} ${cy - r} ${cx} ${cy - r} Q${cx + r} ${cy - r} ${cx + r} ${cy + r * 0.5} Q${cx + r * 0.5} ${cy + r * 0.8} ${cx} ${cy + r * 0.5} Q${cx - r * 0.5} ${cy + r * 0.8} ${cx - r} ${cy + r * 0.5} Z" fill="${color}"/>`,
        flower: `<g fill="${color}"><circle cx="${cx}" cy="${cy - r * 0.5}" r="${r * 0.35}"/><circle cx="${cx - r * 0.5}" cy="${cy}" r="${r * 0.35}"/><circle cx="${cx + r * 0.5}" cy="${cy}" r="${r * 0.35}"/><circle cx="${cx - r * 0.35}" cy="${cy + r * 0.5}" r="${r * 0.35}"/><circle cx="${cx + r * 0.35}" cy="${cy + r * 0.5}" r="${r * 0.35}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.3}" fill="#FFD700"/></g>`,
        rocket: `<g fill="${color}"><path d="M${cx} ${cy - r} Q${cx + r * 0.5} ${cy - r * 0.3} ${cx + r * 0.4} ${cy + r * 0.3} L${cx - r * 0.4} ${cy + r * 0.3} Q${cx - r * 0.5} ${cy - r * 0.3} ${cx} ${cy - r} Z"/><path d="M${cx - r * 0.4} ${cy + r * 0.2} L${cx - r * 0.7} ${cy + r * 0.6} L${cx - r * 0.4} ${cy + r * 0.6} Z" fill="${color}"/><path d="M${cx + r * 0.4} ${cy + r * 0.2} L${cx + r * 0.7} ${cy + r * 0.6} L${cx + r * 0.4} ${cy + r * 0.6} Z" fill="${color}"/><circle cx="${cx}" cy="${cy - r * 0.2}" r="${r * 0.18}" fill="#87CEEB"/></g>`,
        car: `<g fill="${color}"><rect x="${cx - r}" y="${cy - r * 0.3}" width="${r * 2}" height="${r * 0.7}" rx="${r * 0.15}"/><rect x="${cx - r * 0.6}" y="${cy - r * 0.6}" width="${r * 1.2}" height="${r * 0.4}" rx="${r * 0.1}" fill="${color}" opacity="0.8"/><circle cx="${cx - r * 0.5}" cy="${cy + r * 0.5}" r="${r * 0.2}" fill="#333"/><circle cx="${cx + r * 0.5}" cy="${cy + r * 0.5}" r="${r * 0.2}" fill="#333"/></g>`,
        robot: `<g fill="${color}"><rect x="${cx - r * 0.7}" y="${cy - r * 0.6}" width="${r * 1.4}" height="${r * 1.2}" rx="${r * 0.15}"/><rect x="${cx - r * 0.15}" y="${cy - r * 0.9}" width="${r * 0.3}" height="${r * 0.3}" fill="${color}"/><circle cx="${cx}" cy="${cy - r}" r="${r * 0.1}" fill="#FF4444"/></g>`,
    }
    return shapes[type] || shapes.circle
}

function starPoints(cx, cy, r, points) {
    const inner = r * 0.45
    let pts = []
    for (let i = 0; i < points * 2; i++) {
        const rad = i % 2 === 0 ? r : inner
        const angle = (Math.PI / points) * i - Math.PI / 2
        pts.push(`${cx + rad * Math.cos(angle)},${cy + rad * Math.sin(angle)}`)
    }
    return pts.join(' ')
}

function hexPoints(cx, cy, r) {
    let pts = []
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`)
    }
    return pts.join(' ')
}

/** 眼睛 SVG */
function eyesSVG(type, cx, cy) {
    const offset = 12
    const styles = {
        normal: `<circle cx="${cx - offset}" cy="${cy}" r="5" fill="#333"/><circle cx="${cx + offset}" cy="${cy}" r="5" fill="#333"/><circle cx="${cx - offset + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#FFF"/><circle cx="${cx + offset + 1.5}" cy="${cy - 1.5}" r="1.5" fill="#FFF"/>`,
        happy: `<path d="M${cx - offset - 5} ${cy} Q${cx - offset} ${cy - 5} ${cx - offset + 5} ${cy}" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M${cx + offset - 5} ${cy} Q${cx + offset} ${cy - 5} ${cx + offset + 5} ${cy}" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
        wink: `<circle cx="${cx - offset}" cy="${cy}" r="5" fill="#333"/><path d="M${cx + offset - 5} ${cy} Q${cx + offset} ${cy - 5} ${cx + offset + 5} ${cy}" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
        star: `<text x="${cx - offset}" y="${cy + 4}" font-size="12" text-anchor="middle" fill="#FFD700">&#9733;</text><text x="${cx + offset}" y="${cy + 4}" font-size="12" text-anchor="middle" fill="#FFD700">&#9733;</text>`,
        sparkle: `<circle cx="${cx - offset}" cy="${cy}" r="6" fill="#333"/><circle cx="${cx + offset}" cy="${cy}" r="6" fill="#333"/><circle cx="${cx - offset + 2}" cy="${cy - 2}" r="2" fill="#FFF"/><circle cx="${cx + offset + 2}" cy="${cy - 2}" r="2" fill="#FFF"/>`,
        closed: `<path d="M${cx - offset - 5} ${cy + 2} Q${cx - offset} ${cy - 3} ${cx - offset + 5} ${cy + 2}" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M${cx + offset - 5} ${cy + 2} Q${cx + offset} ${cy - 3} ${cx + offset + 5} ${cy + 2}" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    }
    return styles[type] || styles.normal
}

/** 嘴巴 SVG */
function mouthSVG(type, cx, cy) {
    const styles = {
        smile: `<path d="M${cx - 8} ${cy} Q${cx} ${cy + 8} ${cx + 8} ${cy}" stroke="#333" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
        open: `<ellipse cx="${cx}" cy="${cy + 3}" rx="5" ry="4" fill="#333"/>`,
        cat: `<path d="M${cx - 6} ${cy} Q${cx - 3} ${cy + 3} ${cx} ${cy} Q${cx + 3} ${cy + 3} ${cx + 6} ${cy}" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/>`,
        small: `<circle cx="${cx}" cy="${cy}" r="2.5" fill="#333"/>`,
        tongue: `<path d="M${cx - 6} ${cy} Q${cx} ${cy + 6} ${cx + 6} ${cy}" stroke="#333" stroke-width="2" fill="none" stroke-linecap="round"/><ellipse cx="${cx}" cy="${cy + 5}" rx="3" ry="3" fill="#FF69B4"/>`,
    }
    return styles[type] || styles.smile
}

/** 装饰 SVG */
function extrasSVG(extras, cx, cy, r, accentColor) {
    if (!extras || !extras.length) return ''
    let svg = ''
    for (const ex of extras) {
        switch (ex.type) {
            case 'ears-round':
                svg += `<circle cx="${cx - r * 0.6}" cy="${cy - r * 0.7}" r="${r * 0.25}" fill="${accentColor}"/><circle cx="${cx + r * 0.6}" cy="${cy - r * 0.7}" r="${r * 0.25}" fill="${accentColor}"/>`
                break
            case 'ears-long':
                svg += `<ellipse cx="${cx - r * 0.5}" cy="${cy - r * 0.9}" rx="${r * 0.18}" ry="${r * 0.5}" fill="${accentColor}"/><ellipse cx="${cx + r * 0.5}" cy="${cy - r * 0.9}" rx="${r * 0.18}" ry="${r * 0.5}" fill="${accentColor}"/>`
                break
            case 'ears-cat':
                svg += `<polygon points="${cx - r * 0.8},${cy - r * 0.5} ${cx - r * 0.5},${cy - r} ${cx - r * 0.3},${cy - r * 0.5}" fill="${accentColor}"/><polygon points="${cx + r * 0.8},${cy - r * 0.5} ${cx + r * 0.5},${cy - r} ${cx + r * 0.3},${cy - r * 0.5}" fill="${accentColor}"/>`
                break
            case 'ears-flop':
                svg += `<ellipse cx="${cx - r * 0.8}" cy="${cy - r * 0.3}" rx="${r * 0.2}" ry="${r * 0.4}" fill="${accentColor}"/><ellipse cx="${cx + r * 0.8}" cy="${cy - r * 0.3}" rx="${r * 0.2}" ry="${r * 0.4}" fill="${accentColor}"/>`
                break
            case 'spikes':
                for (let i = -2; i <= 2; i++) {
                    svg += `<polygon points="${cx + i * r * 0.3 - r * 0.1},${cy - r * 0.6} ${cx + i * r * 0.3},${cy - r * 0.9} ${cx + i * r * 0.3 + r * 0.1},${cy - r * 0.6}" fill="${accentColor}"/>`
                }
                break
            case 'hat':
                svg += `<path d="M${cx - r * 0.5} ${cy - r * 0.6} L${cx} ${cy - r * 1.2} L${cx + r * 0.5} ${cy - r * 0.6} Z" fill="${accentColor}"/><circle cx="${cx}" cy="${cy - r * 1.2}" r="${r * 0.12}" fill="#FFD700"/>`
                break
            case 'antenna':
                svg += `<line x1="${cx}" y1="${cy - r * 0.6}" x2="${cx}" y2="${cy - r * 1.1}" stroke="${accentColor}" stroke-width="2"/><circle cx="${cx}" cy="${cy - r * 1.15}" r="${r * 0.12}" fill="${accentColor}"/>`
                break
            case 'bow':
                svg += `<polygon points="${cx - r * 0.3},${cy - r * 0.7} ${cx},${cy - r * 0.5} ${cx - r * 0.3},${cy - r * 0.3}" fill="${accentColor}"/><polygon points="${cx + r * 0.3},${cy - r * 0.7} ${cx},${cy - r * 0.5} ${cx + r * 0.3},${cy - r * 0.3}" fill="${accentColor}"/>`
                break
            case 'horn':
                svg += `<path d="M${cx - r * 0.4} ${cy - r * 0.6} L${cx - r * 0.3} ${cy - r} L${cx - r * 0.2} ${cy - r * 0.6} Z" fill="${accentColor}"/><path d="M${cx + r * 0.4} ${cy - r * 0.6} L${cx + r * 0.3} ${cy - r} L${cx + r * 0.2} ${cy - r * 0.6} Z" fill="${accentColor}"/>`
                break
            case 'cheeks':
                svg += `<circle cx="${cx - 16}" cy="${cy + 3}" r="3.5" fill="#FFB6C1" opacity="0.7"/><circle cx="${cx + 16}" cy="${cy + 3}" r="3.5" fill="#FFB6C1" opacity="0.7"/>`
                break
        }
    }
    return svg
}

/**
 * 生成玩偶 SVG 贴图（data URI）
 * @param {Object} config - 玩偶视觉配置
 * @returns {string} SVG data URI
 */
export function generateDollSVG(config) {
    const {
        bodyShape: shape = 'circle',
        bodyColor = '#FF69B4',
        accentColor = '#FFC0CB',
        eyes = 'normal',
        mouth = 'smile',
        extras = [],
    } = config

    const cx = 50, cy = 50, r = 28

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        ${extrasSVG(extras, cx, cy, r, accentColor)}
        ${bodyShape(shape, cx, cy, r, bodyColor)}
        ${eyesSVG(eyes, cx, 44)}
        ${mouthSVG(mouth, cx, 58)}
        ${extras.some(e => e.type === 'cheeks') ? '' : ''}
    </svg>`

    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

// ============================================================
// 6 个娃娃机定义
// ============================================================

export const MACHINES = [
    {
        id: 'plush',
        name: '毛绒乐园',
        image: '/claw-machine-assets/machines-v2/plush.webp',
        themeColor: '#FF69B4',
        gradient: 'from-pink-400 to-rose-400',
        description: '软萌毛绒玩具，抓到就是赚到',
        cost: 1,
        dolls: [
            { id: 'plush-1', name: '小棕熊', isCustom: false, image: '/claw-machine-assets/dolls/plush-0.webp' },
            { id: 'plush-2', name: '小白兔', isCustom: false, image: '/claw-machine-assets/dolls/plush-1.webp' },
            { id: 'plush-3', name: '灰猫咪', isCustom: false, image: '/claw-machine-assets/dolls/plush-2.webp' },
            { id: 'plush-4', name: '小黄狗', isCustom: false, image: '/claw-machine-assets/dolls/plush-3.webp' },
            { id: 'plush-5', name: '绿恐龙', isCustom: false, image: '/claw-machine-assets/dolls/plush-4.webp' },
            { id: 'plush-custom', name: '自定义玩偶', isCustom: true, image: null },
        ],
    },
    {
        id: 'figure',
        name: '手办殿堂',
        image: '/claw-machine-assets/machines-v2/figure.webp',
        themeColor: '#4169E1',
        gradient: 'from-blue-400 to-indigo-500',
        description: '精致手办角色，你的收藏品',
        cost: 2,
        dolls: [
            { id: 'figure-1', name: '银甲战士', isCustom: false, image: '/claw-machine-assets/dolls/figure-0.webp' },
            { id: 'figure-2', name: '紫袍法师', isCustom: false, image: '/claw-machine-assets/dolls/figure-1.webp' },
            { id: 'figure-3', name: '绿衣弓手', isCustom: false, image: '/claw-machine-assets/dolls/figure-2.webp' },
            { id: 'figure-4', name: '金甲骑士', isCustom: false, image: '/claw-machine-assets/dolls/figure-3.webp' },
            { id: 'figure-5', name: '粉裙舞者', isCustom: false, image: '/claw-machine-assets/dolls/figure-4.webp' },
            { id: 'figure-custom', name: '自定义玩偶', isCustom: true, image: null },
        ],
    },
    {
        id: 'blindbox',
        name: '盲盒世界',
        image: '/claw-machine-assets/machines-v2/blindbox.webp',
        themeColor: '#9370DB',
        gradient: 'from-purple-400 to-violet-500',
        description: '神秘盲盒星球，开出惊喜',
        cost: 2,
        dolls: [
            { id: 'blindbox-1', name: '金色星球', isCustom: false, image: '/claw-machine-assets/dolls/blindbox-0.webp' },
            { id: 'blindbox-2', name: '天空云朵', isCustom: false, image: '/claw-machine-assets/dolls/blindbox-1.webp' },
            { id: 'blindbox-3', name: '弯弯月亮', isCustom: false, image: '/claw-machine-assets/dolls/blindbox-2.webp' },
            { id: 'blindbox-4', name: '粉色彩虹', isCustom: false, image: '/claw-machine-assets/dolls/blindbox-3.webp' },
            { id: 'blindbox-5', name: '闪电精灵', isCustom: false, image: '/claw-machine-assets/dolls/blindbox-4.webp' },
            { id: 'blindbox-custom', name: '自定义玩偶', isCustom: true, image: null },
        ],
    },
    {
        id: 'block',
        name: '积木王国',
        image: '/claw-machine-assets/machines-v2/block.webp',
        themeColor: '#32CD32',
        gradient: 'from-green-400 to-emerald-500',
        description: '彩色积木方块，拼搭乐趣',
        cost: 1,
        dolls: [
            { id: 'block-1', name: '热情红块', isCustom: false, image: '/claw-machine-assets/dolls/block-0.webp' },
            { id: 'block-2', name: '冷静蓝块', isCustom: false, image: '/claw-machine-assets/dolls/block-1.webp' },
            { id: 'block-3', name: '活力绿块', isCustom: false, image: '/claw-machine-assets/dolls/block-2.webp' },
            { id: 'block-4', name: '阳光黄块', isCustom: false, image: '/claw-machine-assets/dolls/block-3.webp' },
            { id: 'block-5', name: '神秘紫块', isCustom: false, image: '/claw-machine-assets/dolls/block-4.webp' },
            { id: 'block-custom', name: '自定义玩偶', isCustom: true, image: null },
        ],
    },
    {
        id: 'doll',
        name: '公仔家族',
        image: '/claw-machine-assets/machines-v2/doll.webp',
        themeColor: '#FF8C00',
        gradient: 'from-orange-400 to-amber-500',
        description: '搞怪公仔集合，萌翻天',
        cost: 1,
        dolls: [
            { id: 'doll-1', name: '红蘑菇', isCustom: false, image: '/claw-machine-assets/dolls/doll-0.webp' },
            { id: 'doll-2', name: '小幽灵', isCustom: false, image: '/claw-machine-assets/dolls/doll-1.webp' },
            { id: 'doll-3', name: '绿史莱姆', isCustom: false, image: '/claw-machine-assets/dolls/doll-2.webp' },
            { id: 'doll-4', name: '仙人掌君', isCustom: false, image: '/claw-machine-assets/dolls/doll-3.webp' },
            { id: 'doll-5', name: '小花朵', isCustom: false, image: '/claw-machine-assets/dolls/doll-4.webp' },
            { id: 'doll-custom', name: '自定义玩偶', isCustom: true, image: null },
        ],
    },
    {
        id: 'toy',
        name: '玩具总动员',
        image: '/claw-machine-assets/machines-v2/toy.webp',
        themeColor: '#00CED1',
        gradient: 'from-cyan-400 to-teal-500',
        description: '酷炫玩具大集合',
        cost: 2,
        dolls: [
            { id: 'toy-1', name: '红色火箭', isCustom: false, image: '/claw-machine-assets/dolls/toy-0.webp' },
            { id: 'toy-2', name: '橙色小车', isCustom: false, image: '/claw-machine-assets/dolls/toy-1.webp' },
            { id: 'toy-3', name: '蓝色飞机', isCustom: false, image: '/claw-machine-assets/dolls/toy-2.webp' },
            { id: 'toy-4', name: '航海轮船', isCustom: false, image: '/claw-machine-assets/dolls/toy-3.webp' },
            { id: 'toy-5', name: '灰色机器人', isCustom: false, image: '/claw-machine-assets/dolls/toy-4.webp' },
            { id: 'toy-custom', name: '自定义玩偶', isCustom: true, image: null },
        ],
    },
]

/** 根据 ID 获取娃娃机 */
export function getMachine(machineId) {
    return MACHINES.find(m => m.id === machineId) || null
}

/** 获取娃娃机内所有玩偶（含自定义贴图替换） */
export function getMachineDolls(machineId, customDollImage = null) {
    const machine = getMachine(machineId)
    if (!machine) return []
    return machine.dolls.map(doll => {
        if (doll.isCustom && customDollImage) {
            return { ...doll, image: customDollImage }
        }
        return doll
    })
}
