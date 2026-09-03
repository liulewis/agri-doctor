// 文章详情：标题 / 作者 / 日期 / 正文段落 / 相关推荐 / 收藏 / 复制要点
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    id: '',
    detail: null,
    loading: true,
    // 阅读设置
    fontSizes: [
      { key: 'sm', name: '小', cls: 'fs-sm' },
      { key: 'md', name: '标准', cls: 'fs-md' },
      { key: 'lg', name: '大', cls: 'fs-lg' }
    ],
    fontIndex: 1,
    fontCls: 'fs-md',
    // 目录（正文中的小标题）
    outline: [],
    showOutline: false,
    scrollInto: '',
    favorited: false,
    favText: '收藏'
  },

  onLoad(options) {
    const id = (options && options.id) || 'a1'
    const f = wx.getStorageSync('kb_font')
    let fontIndex = this.data.fontIndex
    if (f === 'sm') fontIndex = 0
    if (f === 'lg') fontIndex = 2
    this.setData({
      id: id,
      fontIndex: fontIndex,
      fontCls: this.data.fontSizes[fontIndex].cls
    })
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadDetail()
  },

  onShareAppMessage() {
    const d = this.data.detail
    return {
      title: d ? d.title : '农技问诊·识病',
      path: '/pages/article/article?id=' + this.data.id
    }
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const r = mock.articleDetail(this.data.id)
    this.render(r)
  },

  // ---------- 云开发模式 ----------
  loadDetail() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'knowledgeOps',
      data: { action: 'detail', id: this.data.id }
    }).then(res => {
      this.render(res.result || {})
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '文章加载失败', icon: 'none' })
    })
  },

  render(r) {
    if (!r.success || !r.detail) {
      this.setData({ loading: false, detail: null })
      return
    }
    const d = r.detail
    // 段落预处理：区分小标题 / 正文 / 要点，避免 WXML 内做判断计算
    const paragraphs = (d.paragraphs || []).map((p, i) => {
      const isHead = typeof p === 'string' && p.indexOf('#') === 0
      const isPoint = typeof p === 'string' && p.indexOf('-') === 0
      const text = isHead ? p.replace(/^#+\s*/, '') : (isPoint ? p.replace(/^-\s*/, '') : p)
      return {
        key: 'p' + i,
        anchor: 'anchor' + i,
        isHead: isHead,
        isPoint: isPoint,
        index: i + 1,
        text: text
      }
    })
    // 目录：优先取小标题；正文无标题时按段落首句生成导航
    const heads = paragraphs.filter(p => p.isHead)
    const src = heads.length ? heads : paragraphs.filter(p => !p.isPoint)
    const outline = src.map((p, i) => ({
      anchor: p.anchor,
      no: i + 1,
      text: util.truncate(p.text.split(/[。！？；]/)[0] || p.text, 18)
    }))
    const words = paragraphs.reduce((s, p) => s + p.text.length, 0)
    this.setData({
      detail: Object.assign({}, d, {
        paragraphs: paragraphs,
        wordText: words + ' 字',
        readText: '约 ' + util.clamp(Math.ceil(words / 300), 1, 30) + ' 分钟'
      }),
      outline: outline,
      favorited: !!d.favorited,
      favText: d.favorited ? '已收藏' : '收藏',
      loading: false
    })
  },
// ---------- 农技问诊 · 交互处理 ----------
  toggleFav() {
    const id = this.data.id
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const r = mock.toggleFavorite(id)
      this.afterFav(r)
      return
    }
    wx.cloud.callFunction({
      name: 'knowledgeOps',
      data: { action: 'favorite', id: id }
    }).then(res => {
      this.afterFav(res.result || {})
    }).catch(() => {
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  afterFav(r) {
    if (!r.success) {
      wx.showToast({ title: r.msg || '操作失败', icon: 'none' })
      return
    }
    this.setData({
      favorited: !!r.favorited,
      favText: r.favorited ? '已收藏' : '收藏'
    })
    wx.showToast({ title: r.msg || '已更新', icon: 'none' })
  },

  pickFont(e) {
    const i = Number(e.currentTarget.dataset.idx)
    const f = this.data.fontSizes[i]
    wx.setStorageSync('kb_font', f.key)
    this.setData({ fontIndex: i, fontCls: f.cls })
  },

  toggleOutline() {
    this.setData({ showOutline: !this.data.showOutline })
  },

  closeOutline() {
    this.setData({ showOutline: false })
  },

  jumpAnchor(e) {
    this.setData({
      scrollInto: e.currentTarget.dataset.anchor,
      showOutline: false
    })
  },

  copyText() {
    const d = this.data.detail
    if (!d) return
    const lines = [d.title, d.author + ' · ' + d.org, '']
    d.paragraphs.forEach(p => { lines.push(p.text) })
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '全文已复制', icon: 'none' })
    })
  },

  goRelated(e) {
    const id = e.currentTarget.dataset.id
    wx.redirectTo({ url: '/pages/article/article?id=' + id })
  },

  goAsk() {
    const d = this.data.detail
    const crop = d ? d.crop : ''
    wx.navigateTo({
      url: '/pages/ask/ask?crop=' + encodeURIComponent(crop)
    })
  },

  goIdentify() {
    wx.navigateTo({ url: '/pages/identify/identify' })
  },

  goKnowledge() {
    wx.switchTab({ url: '/pages/knowledge/knowledge' })
  },

  noop() {}
})
