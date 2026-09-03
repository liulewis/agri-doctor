// 问诊详情：图文对话气泡 + 专家建议卡 + 底部追问 + 评价
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    id: '',
    detail: null,
    loading: true,
    // 追问输入
    reply: '',
    replyLen: 0,
    sending: false,
    // 滚动定位
    scrollInto: '',
    // 评价弹层
    showRate: false,
    rateScore: 5,
    rateStars: [1, 2, 3, 4, 5],
    rateText: '',
    rateTextLen: 0,
    // 预置评价标签：active 在 JS 内维护，避免 WXML 内调用 indexOf
    ratePresets: [
      { name: '回复及时', active: false },
      { name: '讲解清楚', active: false },
      { name: '方案管用', active: false },
      { name: '态度耐心', active: false },
      { name: '专业可靠', active: false }
    ],
    ratePickedText: '',
    // 详情信息折叠
    showInfo: false
  },

  onLoad(options) {
    const id = (options && options.id) || ''
    this.setData({ id: id })
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadDetail()
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const r = mock.consultDetail(this.data.id)
    if (!r.success || !r.detail) {
      this.setData({ loading: false, detail: null })
      return
    }
    this.setData({ detail: r.detail, loading: false })
    this.scrollToBottom(r.detail)
  },

  // ---------- 云开发模式 ----------
  loadDetail() {
    this.setData({ loading: true })
    wx.cloud.callFunction({
      name: 'consultOps',
      data: { action: 'detail', id: this.data.id }
    }).then(res => {
      const r = res.result || {}
      if (r.success && r.detail) {
        this.setData({ detail: r.detail, loading: false })
        this.scrollToBottom(r.detail)
      } else {
        this.setData({ loading: false, detail: null })
        wx.showToast({ title: r.msg || '记录不存在', icon: 'none' })
      }
    }).catch(() => {
      this.setData({ loading: false, detail: null })
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' })
    })
  },

  scrollToBottom(detail) {
    const msgs = (detail && detail.messages) || []
    if (!msgs.length) return
    const last = msgs[msgs.length - 1]
    setTimeout(() => {
      this.setData({ scrollInto: last.key })
    }, 120)
  },

  // ---------- 追问 ----------
  onReply(e) {
    const v = e.detail.value || ''
    this.setData({ reply: v, replyLen: v.length })
  },

  sendReply() {
    if (this.data.sending) return
    const v = util.validateReply(this.data.reply)
    if (!v.ok) {
      wx.showToast({ title: v.msg, icon: 'none' })
      return
    }
    this.setData({ sending: true })
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const r = mock.replyConsult(this.data.id, v.value)
      this.setData({ reply: '', replyLen: 0, sending: false })
      if (r.success) {
        this.applyMock()
        wx.showToast({ title: '追问已发送', icon: 'success' })
      } else {
        wx.showToast({ title: r.msg, icon: 'none' })
      }
      return
    }
    wx.cloud.callFunction({
      name: 'consultOps',
      data: { action: 'reply', id: this.data.id, text: v.value }
    }).then(res => {
      const r = res.result || {}
      this.setData({ reply: '', replyLen: 0, sending: false })
      if (r.success) {
        this.loadDetail()
        wx.showToast({ title: '追问已发送', icon: 'success' })
      } else {
        wx.showToast({ title: r.msg || '发送失败', icon: 'none' })
      }
    }).catch(() => {
      this.setData({ sending: false })
      wx.showToast({ title: '网络异常，发送失败', icon: 'none' })
    })
  },

  // 追问区快捷补充图片（模拟）
  addImage() {
    wx.showToast({ title: '预览模式下图片以占位形式展示', icon: 'none' })
  },

  // ---------- 农技问诊 · 评价 ----------
  openRate() {
    this.setData({ showRate: true })
  },

  closeRate() {
    this.setData({ showRate: false })
  },

  pickScore(e) {
    const n = Number(e.currentTarget.dataset.n) || 5
    this.setData({ rateScore: n })
  },

  onRateText(e) {
    const v = e.detail.value || ''
    this.setData({ rateText: v, rateTextLen: v.length })
  },

  pickPreset(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const presets = this.data.ratePresets.map((p, i) => {
      if (i !== idx) return p
      return { name: p.name, active: !p.active }
    })
    const picked = presets.filter(p => p.active).map(p => p.name)
    this.setData({
      ratePresets: presets,
      ratePickedText: picked.join('、')
    })
  },

  submitRate() {
    let text = (this.data.rateText || '').trim()
    if (!text && this.data.ratePickedText) text = this.data.ratePickedText
    if (!text) text = '整体满意'
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const r = mock.rateConsult(this.data.id, this.data.rateScore, text)
      this.setData({ showRate: false })
      wx.showToast({ title: r.msg || '已提交', icon: 'success' })
      this.applyMock()
      return
    }
    wx.cloud.callFunction({
      name: 'consultOps',
      data: { action: 'rate', id: this.data.id, score: this.data.rateScore, text: text }
    }).then(res => {
      const r = res.result || {}
      this.setData({ showRate: false })
      if (r.success) {
        this.loadDetail()
        wx.showToast({ title: r.msg || '感谢评价', icon: 'success' })
      } else {
        wx.showToast({ title: r.msg || '提交失败', icon: 'none' })
      }
    }).catch(() => {
      this.setData({ showRate: false })
      wx.showToast({ title: '网络异常，提交失败', icon: 'none' })
    })
  },

  // ---------- 其它 ----------
  toggleInfo() {
    this.setData({ showInfo: !this.data.showInfo })
  },

  goExpert() {
    const d = this.data.detail
    if (!d) return
    wx.navigateTo({ url: '/pages/expert/expert?id=' + d.expertId })
  },

  copyAdvice() {
    const d = this.data.detail
    if (!d || !d.advice) return
    const lines = [d.advice.title].concat(d.advice.points.map((p, i) => (i + 1) + '. ' + p))
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '建议已复制', icon: 'success' })
    })
  },

  goAskAgain() {
    const d = this.data.detail
    const crop = d ? d.crop : ''
    wx.navigateTo({ url: '/pages/ask/ask?crop=' + encodeURIComponent(crop) })
  },

  noop() {}
})
