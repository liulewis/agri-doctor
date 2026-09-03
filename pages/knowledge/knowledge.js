// 知识库：病害 / 虫害 / 草害 / 栽培 四分类，支持「图谱」与「文章」双视图
// 双模式：config.useMock -> mock/data.js；否则 wx.cloud.callFunction('knowledgeOps')
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    // 视图：atlas 图谱 / article 文章
    view: 'atlas',
    views: [
      { key: 'atlas', name: '病虫图谱' },
      { key: 'article', name: '农技文章' }
    ],
    // 图谱分类
    types: ['全部', '病害', '虫害', '草害'],
    typeIndex: 0,
    type: '全部',
    // 文章分类
    categories: ['全部', '病害', '虫害', '草害', '栽培'],
    catIndex: 0,
    category: '全部',
    // 数据
    diseases: [],
    articles: [],
    allDiseases: [],
    allArticles: [],
    // 搜索
    keyword: '',
    // 状态
    loading: true,
    countText: '',
    // 热门检索词
    hotWords: ['稻瘟病', '晚疫病', '霜霉病', '蚜虫', '草地贪夜蛾', '除草剂药害'],
    // 底部小贴士
    tips: [
      { icon: '🔍', text: '先按作物+部位缩小范围，再比对图谱特征描述' },
      { icon: '🧪', text: '同一有效成分不要连续使用超过 2 次，注意轮换' },
      { icon: '📅', text: '收藏文章可在「我的 - 我的收藏」中随时回看' }
    ]
  },

  onLoad() {
    // 首页四宫格跳转时写入的分类
    const cat = wx.getStorageSync('kb_category')
    if (cat) {
      wx.removeStorageSync('kb_category')
      const ci = this.data.categories.indexOf(cat)
      const ti = this.data.types.indexOf(cat)
      if (ti >= 0) {
        this.setData({ view: 'atlas', typeIndex: ti, type: cat })
      } else if (ci >= 0) {
        this.setData({ view: 'article', catIndex: ci, category: cat })
      }
    }
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadData()
  },

  onPullDownRefresh() {
    if (config.useMock) {
      this.applyMock()
    } else {
      this.loadData()
    }
    setTimeout(() => wx.stopPullDownRefresh(), 500)
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const d = mock.diseaseList(this.data.type)
    const a = mock.articleList(this.data.category)
    this.setData({
      allDiseases: d.list || [],
      allArticles: (a.list || []).map(this.mapArticle),
      loading: false
    })
    this.filterList()
  },

  // ---------- 云开发模式 ----------
  loadData() {
    this.setData({ loading: true })
    const p1 = wx.cloud.callFunction({
      name: 'knowledgeOps',
      data: { action: 'diseases', type: this.data.type }
    })
    const p2 = wx.cloud.callFunction({
      name: 'knowledgeOps',
      data: { action: 'list', category: this.data.category }
    })
    Promise.all([p1, p2]).then(res => {
      const r1 = (res[0] && res[0].result) || {}
      const r2 = (res[1] && res[1].result) || {}
      this.setData({
        allDiseases: r1.list || [],
        allArticles: (r2.list || []).map(this.mapArticle),
        loading: false
      })
      this.filterList()
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '知识库加载失败', icon: 'none' })
    })
  },

  // 文章列表项补充展示字段（WXML 内不做任何计算）
  mapArticle(a) {
    return {
      id: a.id,
      category: a.category,
      categoryKey: a.categoryKey || util.typeKey(a.category),
      title: a.title,
      crop: a.crop,
      author: a.author,
      org: a.org,
      dateText: a.dateText,
      viewsText: a.viewsText,
      tags: a.tags || [],
      summary: util.truncate(a.summary || '', 56)
    }
  },

  // 关键词本地过滤
  filterList() {
    const k = (this.data.keyword || '').trim()
    let dl = this.data.allDiseases
    let al = this.data.allArticles
    if (k) {
      dl = dl.filter(d => (d.name + d.crop + d.summary).indexOf(k) >= 0)
      al = al.filter(a => (a.title + a.crop + a.summary + a.tags.join('')).indexOf(k) >= 0)
    }
    const n = this.data.view === 'atlas' ? dl.length : al.length
    this.setData({
      diseases: dl,
      articles: al,
      countText: '共 ' + n + ' 条'
    })
  },
// ---------- 农技问诊 · 交互处理 ----------
  switchView(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.view) return
    this.setData({ view: key })
    this.filterList()
  },

  pickType(e) {
    const i = Number(e.currentTarget.dataset.idx)
    this.setData({ typeIndex: i, type: this.data.types[i] })
    if (config.useMock) { this.applyMock() } else { this.loadData() }
  },

  pickCategory(e) {
    const i = Number(e.currentTarget.dataset.idx)
    this.setData({ catIndex: i, category: this.data.categories[i] })
    if (config.useMock) { this.applyMock() } else { this.loadData() }
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value || '' })
    this.filterList()
  },

  tapHotWord(e) {
    const w = e.currentTarget.dataset.w
    this.setData({ keyword: w })
    this.filterList()
  },

  clearKeyword() {
    this.setData({ keyword: '' })
    this.filterList()
  },

  // 图谱条目：直接弹出摘要，并可继续问诊
  tapDisease(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.diseases.filter(d => d.id === id)[0]
    if (!item) return
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const r = mock.diseaseDetail(id)
      if (r.success && r.detail) { this.showDisease(r.detail) } else { this.showDisease(item) }
      return
    }
    wx.cloud.callFunction({
      name: 'knowledgeOps',
      data: { action: 'diseaseDetail', id: id }
    }).then(res => {
      const r = res.result || {}
      if (r.success && r.detail) { this.showDisease(r.detail) }
    }).catch(() => {
      this.showDisease({ name: item.name, crop: item.crop, summary: item.summary })
    })
  },

  showDisease(d) {
    const lines = []
    lines.push('作物：' + (d.crop || '通用'))
    if (d.pathogen) lines.push('病原：' + d.pathogen)
    if (d.season) lines.push('高发期：' + d.season)
    lines.push('')
    lines.push(d.summary || '')
    wx.showModal({
      title: d.name,
      content: lines.join('\n'),
      confirmText: '找专家',
      cancelText: '知道了',
      success: res => {
        if (res.confirm) {
          wx.navigateTo({
            url: '/pages/ask/ask?crop=' + encodeURIComponent(d.crop || '') +
              '&symptom=' + encodeURIComponent('疑似' + d.name + '，' + (d.summary || ''))
          })
        }
      }
    })
  },

  goArticle(e) {
    wx.navigateTo({ url: '/pages/article/article?id=' + e.currentTarget.dataset.id })
  },

  goIdentify() {
    wx.navigateTo({ url: '/pages/identify/identify' })
  },

  goAsk() {
    wx.navigateTo({ url: '/pages/ask/ask' })
  },

  goExpert() {
    wx.navigateTo({ url: '/pages/expert/expert' })
  },

  noop() {}
})
