// 专家问诊列表：进行中 / 已结束 分段切换 + 问诊卡片 + 新建入口
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    status: 'ongoing',
    tabs: [
      { key: 'ongoing', name: '进行中' },
      { key: 'done', name: '已结束' }
    ],
    list: [],
    counts: { ongoing: 0, done: 0 },
    keyword: '',
    allList: [],
    loading: true
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadList()
  },

  onPullDownRefresh() {
    if (config.useMock) this.applyMock()
    else this.loadList()
    setTimeout(() => wx.stopPullDownRefresh(), 400)
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const r = mock.consultList(this.data.status)
    this.setData({
      allList: r.list,
      list: this.filterList(r.list, this.data.keyword),
      counts: r.counts,
      loading: false
    })
  },

  // ---------- 云开发模式 ----------
  loadList() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'consultOps',
      data: { action: 'list', status: this.data.status }
    }).then(res => {
      const r = res.result || {}
      const list = r.list || []
      this.setData({
        allList: list,
        list: this.filterList(list, this.data.keyword),
        counts: r.counts || { ongoing: 0, done: 0 },
        loading: false
      })
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    })
  },

  // 本地关键词过滤（作物 / 症状 / 专家）
  filterList(list, keyword) {
    const kw = (keyword || '').trim()
    if (!kw) return list
    const low = kw.toLowerCase()
    return (list || []).filter(item => {
      const s = (item.crop || '') + (item.symptom || '') + (item.expertName || '')
      return s.toLowerCase().indexOf(low) >= 0
    })
  },

  switchTab(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.status) return
    this.setData({ status: key, loading: true })
    if (config.useMock) this.applyMock()
    else this.loadList()
  },

  onKeyword(e) {
    const v = e.detail.value || ''
    this.setData({
      keyword: v,
      list: this.filterList(this.data.allList, v)
    })
  },

  clearKeyword() {
    this.setData({ keyword: '', list: this.data.allList })
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/consult-detail/consult-detail?id=' + id })
  },

  goAsk() {
    wx.navigateTo({ url: '/pages/ask/ask' })
  },

  goIdentify() {
    wx.navigateTo({ url: '/pages/identify/identify' })
  },

  goExpertList() {
    wx.navigateTo({ url: '/pages/expert/expert' })
  },

  noop() {}
})
