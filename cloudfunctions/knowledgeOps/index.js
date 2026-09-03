// 云函数 knowledgeOps —— 知识库（病虫图谱 + 农技文章 + 收藏）
// action: diseases | diseaseDetail | list | detail | favorites | favorite
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

function truncate(s, n) {
  const str = String(s || '')
  return str.length > n ? (str.slice(0, n) + '…') : str
}

function fmtViews(n) {
  const v = Number(n) || 0
  return v >= 1000 ? ((v / 1000).toFixed(1) + 'k') : ('' + v)
}

function confPercent(n) {
  const v = Number(n) || 0
  const p = v <= 1 ? v * 100 : v
  return Math.max(0, Math.min(100, Math.round(p)))
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

// ---------- 病虫图谱 ----------
async function doDiseases(event) {
  const type = event.type || '全部'
  try {
    const where = (type && type !== '全部') ? { type: type } : {}
    const res = await db.collection('diseases').where(where).orderBy('views', 'desc').limit(100).get()
    const list = (res.data || []).map(d => ({
      id: d.id,
      name: d.name,
      crop: d.crop,
      type: d.type,
      typeKey: typeKey(d.type),
      emoji: d.emoji || '🌿',
      harm: d.harm,
      harmKey: harmKey(d.harm),
      summary: truncate(d.summary, 40),
      percent: confPercent(d.conf),
      views: d.views,
      viewsText: fmtViews(d.views)
    }))
    return { success: true, list: list }
  } catch (e) {
    return { success: false, msg: e.message, list: [] }
  }
}

async function doDiseaseDetail(event) {
  const id = event.id
  if (!id) return { success: false, msg: '缺少图谱 id' }
  try {
    const res = await db.collection('diseases').where({ id: id }).limit(1).get()
    const d = (res.data || [])[0]
    if (!d) return { success: false, msg: '未找到该病害记录' }
    let similarList = []
    if (d.similar && d.similar.length) {
      const sr = await db.collection('diseases').where({ id: _.in(d.similar) }).get()
      similarList = (sr.data || []).map(s => ({
        id: s.id, name: s.name, crop: s.crop, emoji: s.emoji || '🌿'
      }))
    }
    return {
      success: true,
      detail: Object.assign({}, d, {
        similarList: similarList,
        typeKey: typeKey(d.type),
        harmKey: harmKey(d.harm),
        percent: confPercent(d.conf)
      })
    }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

// ---------- 文章 ----------
async function doArticleList(event) {
  const category = event.category || '全部'
  try {
    const where = (category && category !== '全部') ? { category: category } : {}
    const res = await db.collection('articles').where(where).orderBy('date', 'desc').limit(100).get()
    const list = (res.data || []).map(a => ({
      id: a.id,
      category: a.category,
      categoryKey: typeKey(a.category),
      title: a.title,
      crop: a.crop,
      author: a.author,
      org: a.org,
      date: a.date,
      dateText: relTime(a.date),
      views: a.views,
      viewsText: fmtViews(a.views),
      tags: a.tags || [],
      summary: a.summary
    }))
    return { success: true, list: list }
  } catch (e) {
    return { success: false, msg: e.message, list: [] }
  }
}

async function doArticleDetail(event, openid) {
  const id = event.id
  if (!id) return { success: false, msg: '缺少文章 id' }
  try {
    const res = await db.collection('articles').where({ id: id }).limit(1).get()
    const a = (res.data || [])[0]
    if (!a) return { success: false, msg: '文章不存在或已下架' }
    // 阅读量自增
    await db.collection('articles').where({ id: id }).update({ data: { views: _.inc(1) } })
    const rel = await db.collection('articles')
      .where(_.or([{ category: a.category }, { crop: a.crop }]))
      .limit(6)
      .get()
    const related = (rel.data || [])
      .filter(x => x.id !== a.id)
      .slice(0, 4)
      .map(x => ({
        id: x.id,
        title: x.title,
        category: x.category,
        viewsText: fmtViews(x.views)
      }))
    const fav = await db.collection('favorites').where({ _openid: openid, articleId: id }).count()
    return {
      success: true,
      detail: {
        id: a.id,
        category: a.category,
        categoryKey: typeKey(a.category),
        title: a.title,
        crop: a.crop,
        author: a.author,
        org: a.org,
        date: a.date,
        dateText: relTime(a.date),
        views: (a.views || 0) + 1,
        viewsText: fmtViews((a.views || 0) + 1),
        tags: a.tags || [],
        summary: a.summary,
        paragraphs: a.paragraphs || [],
        favorited: (fav.total || 0) > 0,
        related: related
      }
    }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

// ---------- 收藏 ----------
async function doFavorites(event, openid) {
  try {
    const fs = await db.collection('favorites')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    const ids = (fs.data || []).map(f => f.articleId)
    if (!ids.length) return { success: true, list: [] }
    const as = await db.collection('articles').where({ id: _.in(ids) }).get()
    const map = {}
    ;(as.data || []).forEach(a => { map[a.id] = a })
    const list = ids.map(id => {
      const a = map[id]
      if (!a) return null
      return {
        id: a.id,
        title: a.title,
        category: a.category,
        categoryKey: typeKey(a.category),
        crop: a.crop,
        author: a.author,
        viewsText: fmtViews(a.views),
        dateText: relTime(a.date)
      }
    }).filter(Boolean)
    return { success: true, list: list }
  } catch (e) {
    return { success: false, msg: e.message, list: [] }
  }
}

async function doToggleFavorite(event, openid) {
  const id = event.id
  if (!id) return { success: false, msg: '缺少文章 id' }
  try {
    const exist = await db.collection('favorites').where({ _openid: openid, articleId: id }).get()
    if ((exist.data || []).length) {
      await db.collection('favorites').where({ _openid: openid, articleId: id }).remove()
      return { success: true, favorited: false, msg: '已取消收藏' }
    }
    await db.collection('favorites').add({
      data: { _openid: openid, articleId: id, createdAt: Date.now() }
    })
    return { success: true, favorited: true, msg: '已加入收藏' }
  } catch (e) {
    return { success: false, msg: e.message }
  }
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const action = event.action || 'list'
  if (action === 'diseases') return doDiseases(event)
  if (action === 'diseaseDetail') return doDiseaseDetail(event)
  if (action === 'list') return doArticleList(event)
  if (action === 'detail') return doArticleDetail(event, OPENID)
  if (action === 'favorites') return doFavorites(event, OPENID)
  if (action === 'favorite') return doToggleFavorite(event, OPENID)
  return { success: false, msg: '未知 action: ' + action }
}
