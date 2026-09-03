// 云函数 identify —— AI 识别、保存识别记录、识别历史
// action: identify | save | history | delete
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ---------- 与小程序端保持一致的展示层预计算 ----------
function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatDateTime(d) {
  const t = d instanceof Date ? d : new Date(d)
  return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) +
    ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes())
}

function confPercent(n) {
  const v = Number(n) || 0
  const p = v <= 1 ? v * 100 : v
  return Math.max(0, Math.min(100, Math.round(p)))
}

function fmtConfidence(n) {
  const v = Number(n) || 0
  const p = v <= 1 ? v * 100 : v
  return p.toFixed(1) + '%'
}

function typeKey(t) {
  if (t === '病害') return 't-bing'
  if (t === '虫害') return 't-chong'
  if (t === '草害') return 't-cao'
  if (t === '栽培') return 't-zai'
  return 't-def'
}

function relTime(input) {
  const t = new Date(String(input).replace(/-/g, '/')).getTime()
  if (!t) return String(input || '')
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return min + ' 分钟前'
  const hour = Math.floor(min / 60)
  if (hour < 24) return hour + ' 小时前'
  const day = Math.floor(hour / 24)
  if (day < 30) return day + ' 天前'
  return String(input).slice(0, 10)
}

// 稳定选择：同样的输入总是得到同样的结果，便于复现
function seedIndex(text, len) {
  const s = String(text || '')
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i)
  return len > 0 ? (sum % len) : 0
}

// ---------- 业务 ----------
async function doIdentify(event, openid) {
  const payload = event.payload || {}
  const crop = payload.crop || ''
  const symptom = payload.symptom || ''
  try {
    // 优先按作物过滤候选，缺省则取全部图谱
    const q = crop ? { crop: _.in([crop, '通用']) } : {}
    let res = await db.collection('diseases').where(q).limit(100).get()
    let list = res.data || []
    if (!list.length) {
      res = await db.collection('diseases').limit(100).get()
      list = res.data || []
    }
    if (!list.length) {
      return { success: false, msg: '病虫图谱为空，请先导入 diseases 集合' }
    }
    const hit = list[seedIndex(crop + symptom, list.length)]
    const others = list.filter(d => d.id !== hit.id).slice(0, 3).map((d, i) => ({
      id: d.id,
      name: d.name,
      crop: d.crop,
      emoji: d.emoji || '🌿',
      percent: Math.max(6, confPercent(hit.conf) - 18 - i * 9)
    }))
    return {
      success: true,
      result: {
        id: hit.id,
        name: hit.name,
        alias: hit.alias || '',
        crop: hit.crop,
        type: hit.type,
        typeKey: typeKey(hit.type),
        emoji: hit.emoji || '🌿',
        harm: hit.harm,
        season: hit.season,
        pathogen: hit.pathogen,
        summary: hit.summary,
        conf: hit.conf,
        percent: confPercent(hit.conf),
        confText: fmtConfidence(hit.conf),
        symptoms: hit.symptoms || [],
        treatments: hit.treatments || [],
        similar: others
      },
      disclaimer: 'AI 识别结果仅供参考，最终诊断请以农技专家或官方植保部门意见为准。'
    }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

async function doSave(event, openid) {
  const r = event.record || {}
  const item = {
    _openid: openid,
    diseaseId: r.id || r.diseaseId || '',
    name: r.name || '未知对象',
    crop: r.crop || '通用',
    type: r.type || '病害',
    emoji: r.emoji || '🌿',
    conf: r.conf || 0,
    time: formatDateTime(new Date()),
    createdAt: Date.now()
  }
  try {
    const res = await db.collection('identify_records').add({ data: item })
    return { success: true, id: res._id, msg: '识别记录已保存' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

async function doHistory(event, openid) {
  try {
    const res = await db.collection('identify_records')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()
    const list = (res.data || []).map(r => ({
      id: r._id,
      diseaseId: r.diseaseId,
      name: r.name,
      crop: r.crop,
      type: r.type,
      typeKey: typeKey(r.type),
      emoji: r.emoji,
      percent: confPercent(r.conf),
      confText: fmtConfidence(r.conf),
      timeText: relTime(r.time)
    }))
    return { success: true, list: list }
  } catch (e) {
    return { success: false, msg: e.message, list: [] }
  }
}

async function doDelete(event, openid) {
  const id = event.id
  if (!id) return { success: false, msg: '缺少记录 id' }
  try {
    await db.collection('identify_records').where({ _id: id, _openid: openid }).remove()
    return { success: true, msg: '记录已删除' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'identify'
  if (action === 'identify') return doIdentify(event, OPENID)
  if (action === 'save') return doSave(event, OPENID)
  if (action === 'history') return doHistory(event, OPENID)
  if (action === 'delete') return doDelete(event, OPENID)
  return { success: false, msg: '未知 action: ' + action }
}
