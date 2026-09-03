// 首页：拍照识别大入口 + 热门病害 + 推荐专家 + 知识库入口 + 问诊概览 + 公告
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    today: '',
    greeting: '',
    // 我的问诊概览
    overview: {
      ongoing: 0,
      done: 0,
      identified: 0,
      favorites: 0,
      unread: 0
    },
    hasUnread: false,
    // 热门病害（横滑）
    hotDiseases: [],
    // 推荐专家
    recommendExperts: [],
    // 平台公告
    notices: [],
    noticeIndex: 0,
    // 知识库四个分类入口
    kbEntries: [
      { key: '病害', icon: '🍂', name: '病害防治', desc: '真菌细菌病毒' },
      { key: '虫害', icon: '🐛', name: '虫害识别', desc: '监测与用药' },
      { key: '草害', icon: '🌿', name: '草害除治', desc: '安全除草剂' },
      { key: '栽培', icon: '🌱', name: '栽培管理', desc: '水肥与环境' }
    ],
    loading: true
  },

  onLoad() {
    const h = new Date().getHours()
    let greeting = '你好'
    if (h < 6) greeting = '夜深了'
    else if (h < 11) greeting = '早上好'
    else if (h < 14) greeting = '中午好'
    else if (h < 18) greeting = '下午好'
    else greeting = '晚上好'
    this.setData({
      today: util.formatDate(new Date()),
      greeting: greeting
    })
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadOverview()
  },

  onPullDownRefresh() {
    if (config.useMock) this.applyMock()
    else this.loadOverview()
    setTimeout(() => wx.stopPullDownRefresh(), 400)
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const r = mock.overview()
    this.setData({
      overview: r.overview,
      hasUnread: r.overview.unread > 0,
      hotDiseases: r.hotDiseases,
      recommendExperts: r.recommendExperts,
      notices: r.notices,
      loading: false
    })
  },

  // ---------- 云开发模式 ----------
  loadOverview() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'consultOps',
      data: { action: 'overview' }
    }).then(res => {
      const r = res.result || {}
      if (!r.success) {
        this.setData({ loading: false })
        return
      }
      const ov = r.overview || { ongoing: 0, done: 0, identified: 0, favorites: 0, unread: 0 }
      this.setData({
        overview: ov,
        hasUnread: ov.unread > 0,
        hotDiseases: r.hotDiseases || [],
        recommendExperts: r.recommendExperts || [],
        notices: r.notices || [],
        loading: false
      })
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    })
  },
// ---------- 农技问诊 · 交互处理 ----------
  goIdentify() {
    wx.navigateTo({ url: '/pages/identify/identify' })
  },

  goIdentifyWith(e) {
    const crop = e.currentTarget.dataset.crop || ''
    wx.navigateTo({ url: '/pages/identify/identify?crop=' + encodeURIComponent(crop) })
  },

  goConsult() {
    wx.switchTab({ url: '/pages/consult/consult' })
  },

  goAsk() {
    wx.navigateTo({ url: '/pages/ask/ask' })
  },

  goKnowledge() {
    wx.switchTab({ url: '/pages/knowledge/knowledge' })
  },

  goKnowledgeCategory(e) {
    const key = e.currentTarget.dataset.key || ''
    wx.setStorageSync('kb_category', key)
    wx.switchTab({ url: '/pages/knowledge/knowledge' })
  },

  goExpertList() {
    wx.navigateTo({ url: '/pages/expert/expert' })
  },

  goExpert(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/expert/expert?id=' + id })
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  // 热门病害卡片：进入识别页并带上作物，便于快速比对
  tapDisease(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    wx.showModal({
      title: item.name,
      content: '作物：' + item.crop + '\n类型：' + item.type + '\n危害等级：' + item.harm + '\n\n可前往拍照识别进行比对，或向专家发起问诊。',
      confirmText: '去识别',
      cancelText: '去问诊',
      success: res => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/identify/identify?crop=' + encodeURIComponent(item.crop) })
        } else if (res.cancel) {
          wx.navigateTo({ url: '/pages/ask/ask?crop=' + encodeURIComponent(item.crop) })
        }
      }
    })
  },

  // 公告轮播切换
  onNoticeChange(e) {
    this.setData({ noticeIndex: e.detail.current })
  },

  tapNotice(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    wx.showModal({
      title: item.title,
      content: item.text,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  noop() {}
})
