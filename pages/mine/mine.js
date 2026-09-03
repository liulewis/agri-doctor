// 我的：概览统计 / 我的问诊 / 识别记录 / 我的收藏 / 消息中心 / 设置
// 双模式：config.useMock -> mock/data.js；否则 consultOps + knowledgeOps + identify 云函数
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    // 用户信息（本地模拟，不申请任何隐私接口）
    user: {
      avatar: '🧑‍🌾',
      name: '临河镇 · 张大叔',
      desc: '水稻 12 亩 / 番茄棚 2 座',
      levelText: '田间达人 Lv.3'
    },
    // 概览
    overview: { ongoing: 0, done: 0, identified: 0, favorites: 0, unread: 0 },
    // 分栏：favorites 收藏 / history 识别记录 / messages 消息
    tab: 'favorites',
    tabs: [
      { key: 'favorites', name: '我的收藏' },
      { key: 'history', name: '识别记录' },
      { key: 'messages', name: '消息中心' }
    ],
    favorites: [],
    history: [],
    messages: [],
    hasUnread: false,
    loading: true,
    // 功能入口
    tools: [
      { key: 'consult', icon: '💬', title: '我的问诊', sub: '查看进行中与已完成的问诊' },
      { key: 'identify', icon: '📷', title: '拍照识病虫', sub: 'AI 秒级识别，支持保存记录' },
      { key: 'expert', icon: '👨‍🌾', title: '专家名录', sub: '按作物与擅长方向找专家' },
      { key: 'knowledge', icon: '📚', title: '知识库', sub: '病虫图谱与农技文章' }
    ],
    // 设置项
    settings: [
      { key: 'crop', icon: '🌾', title: '我的作物', extra: '水稻 / 番茄' },
      { key: 'notice', icon: '🔔', title: '病虫预警提醒', extra: '已开启' },
      { key: 'cache', icon: '🧹', title: '清理缓存', extra: '' },
      { key: 'disclaimer', icon: '⚠️', title: '免责声明', extra: '' },
      { key: 'about', icon: 'ℹ️', title: '关于我们', extra: 'v1.0.0' }
    ],
    // 数据来源说明
    dataFrom: config.useMock ? '当前为本地预览数据（config.useMock = true）' : '当前为云开发数据'
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadAll()
  },

  onPullDownRefresh() {
    if (config.useMock) { this.applyMock() } else { this.loadAll() }
    setTimeout(() => wx.stopPullDownRefresh(), 500)
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const ov = mock.overview()
    const fav = mock.myFavorites()
    const his = mock.identifyHistory()
    const msg = mock.messageList()
    this.render(ov, fav.list || [], his.list || [], msg.list || [])
  },

  // ---------- 云开发模式 ----------
  loadAll() {
    this.setData({ loading: true })
    const p1 = wx.cloud.callFunction({ name: 'consultOps', data: { action: 'overview' } })
    const p2 = wx.cloud.callFunction({ name: 'knowledgeOps', data: { action: 'favorites' } })
    const p3 = wx.cloud.callFunction({ name: 'identify', data: { action: 'history' } })
    const p4 = wx.cloud.callFunction({ name: 'consultOps', data: { action: 'messages' } })
    Promise.all([p1, p2, p3, p4]).then(res => {
      const ov = (res[0] && res[0].result) || {}
      const fav = (res[1] && res[1].result) || {}
      const his = (res[2] && res[2].result) || {}
      const msg = (res[3] && res[3].result) || {}
      this.render(ov, fav.list || [], his.list || [], msg.list || [])
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '数据加载失败', icon: 'none' })
    })
  },

  render(ov, favorites, history, messages) {
    const o = ov.overview || { ongoing: 0, done: 0, identified: 0, favorites: 0, unread: 0 }
    this.setData({
      overview: o,
      favorites: favorites,
      history: history,
      messages: messages,
      hasUnread: (o.unread || 0) > 0,
      loading: false
    })
  },
// ---------- 农技问诊 · 交互处理 ----------
  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.key })
  },

  tapTool(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'consult') { wx.switchTab({ url: '/pages/consult/consult' }); return }
    if (key === 'knowledge') { wx.switchTab({ url: '/pages/knowledge/knowledge' }); return }
    if (key === 'identify') { wx.navigateTo({ url: '/pages/identify/identify' }); return }
    if (key === 'expert') { wx.navigateTo({ url: '/pages/expert/expert' }) }
  },

  goArticle(e) {
    wx.navigateTo({ url: '/pages/article/article?id=' + e.currentTarget.dataset.id })
  },

  goConsult() {
    wx.switchTab({ url: '/pages/consult/consult' })
  },

  goConsultDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) { this.goConsult(); return }
    wx.navigateTo({ url: '/pages/consult-detail/consult-detail?id=' + id })
  },

  goIdentify() {
    wx.navigateTo({ url: '/pages/identify/identify' })
  },

  goKnowledge() {
    wx.switchTab({ url: '/pages/knowledge/knowledge' })
  },

  // 识别记录 -> 直接带着结论发起问诊
  askFromHistory(e) {
    const id = e.currentTarget.dataset.id
    const item = this.data.history.filter(h => h.id === id)[0]
    if (!item) return
    wx.navigateTo({
      url: '/pages/ask/ask?crop=' + encodeURIComponent(item.crop) +
        '&symptom=' + encodeURIComponent('AI 识别为' + item.name + '（置信度 ' + item.confText + '），请专家复核。')
    })
  },

  // 消息全部已读
  readAll() {
    if (!this.data.hasUnread) {
      wx.showToast({ title: '没有未读消息', icon: 'none' })
      return
    }
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      mock.readAllMessages()
      this.applyMock()
      wx.showToast({ title: '已全部标为已读', icon: 'none' })
      return
    }
    wx.cloud.callFunction({
      name: 'consultOps',
      data: { action: 'readAll' }
    }).then(() => {
      this.loadAll()
      wx.showToast({ title: '已全部标为已读', icon: 'none' })
    }).catch(() => {
      wx.showToast({ title: '操作失败', icon: 'none' })
    })
  },

  tapMessage(e) {
    const id = e.currentTarget.dataset.id
    const m = this.data.messages.filter(x => x.id === id)[0]
    if (!m) return
    if (m.consultId) {
      wx.navigateTo({ url: '/pages/consult-detail/consult-detail?id=' + m.consultId })
      return
    }
    wx.showModal({
      title: m.title,
      content: m.text,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  tapSetting(e) {
    const key = e.currentTarget.dataset.key
    if (key === 'cache') { this.clearCache(); return }
    if (key === 'about') { this.showAbout(); return }
    if (key === 'disclaimer') { this.showDisclaimer(); return }
    if (key === 'crop') {
      wx.showModal({
        title: '我的作物',
        content: '当前关注：水稻、番茄。设置后首页将优先推送对应作物的病虫预警与农技文章。',
        confirmText: '去问诊',
        cancelText: '知道了',
        success: res => { if (res.confirm) wx.navigateTo({ url: '/pages/ask/ask' }) }
      })
      return
    }
    if (key === 'notice') {
      wx.showToast({ title: '预警提醒已开启', icon: 'none' })
    }
  },

  clearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '将清除本地阅读设置与临时图片缓存，不会影响你的问诊与收藏数据。',
      confirmText: '立即清理',
      success: res => {
        if (!res.confirm) return
        try {
          wx.removeStorageSync('kb_font')
          wx.removeStorageSync('kb_category')
        } catch (err) {
          // 忽略清理异常，保证流程不中断
        }
        wx.showToast({ title: '缓存已清理', icon: 'success' })
      }
    })
  },

  showAbout() {
    wx.showModal({
      title: '农技问诊·识病 v1.0.0',
      content: '面向种植户的 AI 识病 + 专家问诊小程序 MVP。识别模型与专家数据为演示内容，正式版将接入省级植保数据库。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showDisclaimer() {
    wx.showModal({
      title: '免责声明',
      content: 'AI 识别与专家远程建议均为辅助参考，不能替代田间实地诊断。农药使用剂量、稀释倍数与安全间隔期，请严格以农药标签及当地植保部门指导为准。',
      showCancel: false,
      confirmText: '我已知晓'
    })
  },

  copyId() {
    wx.setClipboardData({
      data: 'agri-doctor-' + util.uid('u'),
      success: () => wx.showToast({ title: '用户标识已复制', icon: 'none' })
    })
  },

  noop() {}
})
