// 云函数 consultOps —— 问诊全流程
// action: list | detail | create | reply | rate | overview | messages | readAll | close
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatDateTime(d) {
  const t = d instanceof Date ? d : new Date(d)
  return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()) +
    ' ' + pad(t.getHours()) + ':' + pad(t.getMinutes())
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

function truncate(s, n) {
  const str = String(s || '')
  return str.length > n ? (str.slice(0, n) + '…') : str
}

function fmtViews(n) {
  const v = Number(n) || 0
  return v >= 1000 ? ((v / 1000).toFixed(1) + 'k') : ('' + v)
}

function typeKey(t) {
  if (t === '病害') return 't-bing'
  if (t === '虫害') return 't-chong'
  if (t === '草害') return 't-cao'
  if (t === '栽培') return 't-zai'
  return 't-def'
}

function harmKey(h) {
  if (h === '极高') return 'h-max'
  if (h === '高') return 'h-high'
  if (h === '中') return 'h-mid'
  return 'h-low'
}

// ---------- 列表 ----------
async function doList(event, openid) {
  const status = event.status || 'all'
  try {
    const where = { _openid: openid }
    if (status !== 'all') where.status = status
    const res = await db.collection('consults')
      .where(where)
      .orderBy('updatedAt', 'desc')
      .limit(60)
      .get()
    const list = (res.data || []).map(c => ({
      id: c._id,
      status: c.status,
      statusText: c.statusText,
      crop: c.crop,
      stage: c.stage,
      urgency: c.urgency,
      symptom: truncate(c.symptom, 46),
      expertName: c.expertName,
      expertAvatar: c.expertAvatar,
      unread: c.unread || 0,
      hasUnread: (c.unread || 0) > 0,
      rated: !!c.rated,
      msgCount: (c.messages || []).length,
      dateText: relTime(c.updatedAt)
    }))
    const all = await db.collection('consults').where({ _openid: openid }).limit(100).get()
    const rows = all.data || []
    return {
      success: true,
      list: list,
      counts: {
        ongoing: rows.filter(c => c.status === 'ongoing').length,
        done: rows.filter(c => c.status === 'done').length
      }
    }
  } catch (e) {
    return { success: false, msg: e.message, list: [], counts: { ongoing: 0, done: 0 } }
  }
}

// ---------- 农技问诊 · 详情 ----------
async function doDetail(event, openid) {
  const id = event.id
  if (!id) return { success: false, msg: '缺少问诊 id' }
  try {
    const res = await db.collection('consults').doc(id).get()
    const c = res.data
    if (!c || c._openid !== openid) return { success: false, msg: '问诊记录不存在' }
    const msgs = (c.messages || []).map((m, i) => ({
      key: id + '_m' + i,
      role: m.role,
      isUser: m.role === 'user',
      type: m.type,
      isImage: m.type === 'image',
      text: m.text,
      emoji: m.emoji || '',
      time: m.time,
      timeText: String(m.time || '').slice(5)
    }))
    return {
      success: true,
      detail: {
        id: id,
        status: c.status,
        statusText: c.statusText,
        isDone: c.status === 'done',
        crop: c.crop,
        stage: c.stage,
        urgency: c.urgency,
        symptom: c.symptom,
        area: c.area,
        location: c.location,
        expertId: c.expertId,
        expertName: c.expertName,
        expertAvatar: c.expertAvatar,
        createdAt: c.createdAt,
        createdText: relTime(c.createdAt),
        advice: c.advice || null,
        hasAdvice: !!c.advice,
        rated: !!c.rated,
        rating: c.rating || 0,
        ratingText: c.ratingText || '',
        messages: msgs
      }
    }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

// ---------- 新建 ----------
async function doCreate(event, openid) {
  const p = event.payload || {}
  if (!p.symptom || String(p.symptom).trim().length < 5) {
    return { success: false, msg: '症状描述至少 5 个字' }
  }
  const now = formatDateTime(new Date())
  try {
    let expert = null
    if (p.expertId) {
      const er = await db.collection('experts').where({ id: p.expertId }).limit(1).get()
      expert = (er.data || [])[0] || null
    }
    if (!expert) {
      const er = await db.collection('experts').orderBy('rating', 'desc').limit(1).get()
      expert = (er.data || [])[0] || { id: '', name: '值班农技员', avatar: '👨‍🌾' }
    }
    const messages = [{ role: 'user', type: 'text', text: p.symptom, time: now }]
    const imgs = Number(p.imageCount) || 0
    for (let i = 0; i < imgs; i++) {
      messages.push({ role: 'user', type: 'image', text: '田间照片 ' + (i + 1), emoji: '📷', time: now })
    }
    const record = {
      _openid: openid,
      status: 'ongoing',
      statusText: '等待专家接诊',
      crop: p.crop || '通用',
      stage: p.stage || '苗期',
      urgency: p.urgency || '一般咨询（3 个工作日）',
      symptom: p.symptom,
      area: p.area || '未填写',
      location: p.location || '未填写',
      expertId: expert.id,
      expertName: expert.name,
      expertAvatar: expert.avatar || '👨‍🌾',
      createdAt: now,
      updatedAt: now,
      unread: 0,
      rated: false,
      advice: null,
      messages: messages
    }
    const r = await db.collection('consults').add({ data: record })
    return { success: true, id: r._id, msg: '问诊已提交，专家将尽快接诊' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

// ---------- 追问 ----------
async function doReply(event, openid) {
  const id = event.id
  const text = String(event.text || '').trim()
  if (!id) return { success: false, msg: '缺少问诊 id' }
  if (!text) return { success: false, msg: '请输入内容' }
  if (text.length > 200) return { success: false, msg: '内容不能超过 200 字' }
  const now = formatDateTime(new Date())
  try {
    await db.collection('consults').where({ _id: id, _openid: openid }).update({
      data: {
        messages: _.push([{ role: 'user', type: 'text', text: text, time: now }]),
        updatedAt: now,
        statusText: '等待专家回复'
      }
    })
    return { success: true, msg: '已发送' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

// ---------- 农技问诊 · 评价 ----------
async function doRate(event, openid) {
  const id = event.id
  const score = Number(event.score) || 5
  const text = String(event.text || '')
  if (!id) return { success: false, msg: '缺少问诊 id' }
  try {
    await db.collection('consults').where({ _id: id, _openid: openid }).update({
      data: { rated: true, rating: score, ratingText: text }
    })
    return { success: true, msg: '感谢你的评价' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

// ---------- 结束问诊 ----------
async function doClose(event, openid) {
  const id = event.id
  if (!id) return { success: false, msg: '缺少问诊 id' }
  try {
    await db.collection('consults').where({ _id: id, _openid: openid }).update({
      data: { status: 'done', statusText: '已完成', updatedAt: formatDateTime(new Date()) }
    })
    return { success: true, msg: '问诊已结束' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

// ---------- 首页概览 ----------
async function doOverview(event, openid) {
  try {
    const cs = await db.collection('consults').where({ _openid: openid }).limit(100).get()
    const rows = cs.data || []
    const irs = await db.collection('identify_records').where({ _openid: openid }).count()
    const favs = await db.collection('favorites').where({ _openid: openid }).count()
    const msg = await db.collection('messages').where({ _openid: openid, unread: true }).count()

    const ds = await db.collection('diseases').orderBy('views', 'desc').limit(6).get()
    const hotDiseases = (ds.data || []).map(d => ({
      id: d.id,
      name: d.name,
      crop: d.crop,
      type: d.type,
      typeKey: typeKey(d.type),
      emoji: d.emoji || '🌿',
      harm: d.harm,
      harmKey: harmKey(d.harm),
      viewsText: fmtViews(d.views)
    }))

    const es = await db.collection('experts').orderBy('rating', 'desc').limit(3).get()
    const recommendExperts = (es.data || []).map(e => ({
      id: e.id,
      name: e.name,
      avatar: e.avatar,
      title: e.title,
      field: e.field,
      ratingText: Number(e.rating || 0).toFixed(1),
      servedText: fmtViews(e.served),
      online: !!e.online,
      onlineText: e.online ? '在线' : '离线'
    }))

    const ns = await db.collection('notices').orderBy('date', 'desc').limit(5).get()
    const notices = (ns.data || []).map(n => ({
      id: n.id || n._id,
      level: n.level,
      icon: n.icon,
      title: n.title,
      text: n.text,
      dateText: relTime(n.date)
    }))

    return {
      success: true,
      overview: {
        ongoing: rows.filter(c => c.status === 'ongoing').length,
        done: rows.filter(c => c.status === 'done').length,
        identified: irs.total || 0,
        favorites: favs.total || 0,
        unread: msg.total || 0
      },
      notices: notices,
      hotDiseases: hotDiseases,
      recommendExperts: recommendExperts
    }
  } catch (e) {
    return {
      success: false,
      msg: e.message,
      overview: { ongoing: 0, done: 0, identified: 0, favorites: 0, unread: 0 },
      notices: [],
      hotDiseases: [],
      recommendExperts: []
    }
  }
}

// ---------- 消息中心 ----------
async function doMessages(event, openid) {
  try {
    const res = await db.collection('messages')
      .where({ _openid: openid })
      .orderBy('time', 'desc')
      .limit(50)
      .get()
    const list = (res.data || []).map(m => ({
      id: m._id,
      type: m.type,
      icon: m.icon,
      title: m.title,
      text: m.text,
      unread: !!m.unread,
      consultId: m.consultId || '',
      timeText: relTime(m.time)
    }))
    return { success: true, list: list }
  } catch (e) {
    return { success: false, msg: e.message, list: [] }
  }
}

async function doReadAll(event, openid) {
  try {
    await db.collection('messages').where({ _openid: openid, unread: true }).update({
      data: { unread: false }
    })
    return { success: true, msg: '已全部标为已读' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'list'
  if (action === 'list') return doList(event, OPENID)
  if (action === 'detail') return doDetail(event, OPENID)
  if (action === 'create') return doCreate(event, OPENID)
  if (action === 'reply') return doReply(event, OPENID)
  if (action === 'rate') return doRate(event, OPENID)
  if (action === 'close') return doClose(event, OPENID)
  if (action === 'overview') return doOverview(event, OPENID)
  if (action === 'messages') return doMessages(event, OPENID)
  if (action === 'readAll') return doReadAll(event, OPENID)
  return { success: false, msg: '未知 action: ' + action }
}
