// 云函数 expertOps —— 专家名录
// action: list | detail
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function fmtViews(n) {
  const v = Number(n) || 0
  return v >= 1000 ? ((v / 1000).toFixed(1) + 'k') : ('' + v)
}

function truncate(s, n) {
  const str = String(s || '')
  return str.length > n ? (str.slice(0, n) + '…') : str
}

function starsOf(rating) {
  const v = Math.max(0, Math.min(5, Number(rating) || 0))
  const arr = []
  for (let i = 1; i <= 5; i++) {
    if (v >= i) arr.push('full')
    else if (v >= i - 0.5) arr.push('half')
    else arr.push('empty')
  }
  return arr
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

async function doList(event) {
  try {
    const res = await db.collection('experts').orderBy('rating', 'desc').limit(60).get()
    const list = (res.data || []).map(e => ({
      id: e.id,
      name: e.name,
      avatar: e.avatar || '👨‍🌾',
      title: e.title,
      org: e.org,
      field: e.field,
      crops: e.crops || [],
      rating: e.rating,
      ratingText: Number(e.rating || 0).toFixed(1),
      stars: starsOf(e.rating),
      served: e.served,
      servedText: fmtViews(e.served),
      respond: e.respond,
      online: !!e.online,
      onlineText: e.online ? '在线' : '离线',
      tagsList: e.tagsList || []
    }))
    return { success: true, list: list }
  } catch (e) {
    return { success: false, msg: e.message, list: [] }
  }
}

async function doDetail(event, openid) {
  const id = event.id
  if (!id) return { success: false, msg: '缺少专家 id' }
  try {
    const res = await db.collection('experts').where({ id: id }).limit(1).get()
    const e = (res.data || [])[0]
    if (!e) return { success: false, msg: '专家信息不存在' }
    const cs = await db.collection('consults')
      .where({ expertId: id })
      .orderBy('updatedAt', 'desc')
      .limit(3)
      .get()
    const cases = (cs.data || []).map(c => ({
      id: c._id,
      crop: c.crop,
      symptom: truncate(c.symptom, 34),
      statusText: c.statusText,
      dateText: relTime(c.createdAt)
    }))
    return {
      success: true,
      detail: {
        id: e.id,
        name: e.name,
        avatar: e.avatar || '👨‍🌾',
        title: e.title,
        org: e.org,
        field: e.field,
        crops: e.crops || [],
        rating: e.rating,
        ratingText: Number(e.rating || 0).toFixed(1),
        stars: starsOf(e.rating),
        served: e.served,
        servedText: fmtViews(e.served),
        respond: e.respond,
        online: !!e.online,
        onlineText: e.online ? '在线接诊中' : '暂时离线',
        years: e.years,
        price: e.price,
        intro: e.intro,
        tagsList: e.tagsList || [],
        honors: e.honors || [],
        cases: cases
      }
    }
  } catch (err) {
    return { success: false, msg: err.message }
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'list'
  if (action === 'list') return doList(event)
  if (action === 'detail') return doDetail(event, OPENID)
  return { success: false, msg: '未知 action: ' + action }
}
