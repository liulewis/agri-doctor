// 发起问诊：作物 / 生育期 / 症状描述 / 紧急程度 / 图片占位 / 选择专家
// 全部字段经 utils/util.js 校验后写入 mock 或云函数
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    // 字典
    crops: [],
    stages: [],
    urgency: [],
    // 选中索引（WXML 内不做任何计算，索引全部在 JS 预置）
    cropIndex: 0,
    stageIndex: 1,
    urgencyIndex: 0,
    crop: '',
    stage: '',
    urgencyText: '',
    // 文本
    symptom: '',
    symptomLen: 0,
    area: '',
    location: '',
    // 图片占位（预览模式下以 emoji 表示）
    images: [],
    imageEmojis: ['🌿', '🍃', '🌾', '🐛', '🍅', '🌽'],
    // 专家
    experts: [],
    expertId: '',
    expertName: '',
    // 常见症状快捷标签
    quickTags: [
      { name: '叶片有斑点', active: false },
      { name: '叶片发黄', active: false },
      { name: '叶片卷曲', active: false },
      { name: '茎秆变黑', active: false },
      { name: '有虫子啃食', active: false },
      { name: '整株萎蔫', active: false },
      { name: '果实腐烂', active: false },
      { name: '生长缓慢', active: false }
    ],
    // 错误提示
    errSymptom: '',
    errCrop: '',
    submitting: false,
    canSubmit: false
  },

  onLoad(options) {
    const dict = this.getDict()
    const crops = dict.crops
    let cropIndex = 0
    let symptom = ''
    if (options && options.crop) {
      const c = decodeURIComponent(options.crop)
      const i = crops.indexOf(c)
      if (i >= 0) cropIndex = i
    }
    if (options && options.symptom) {
      symptom = decodeURIComponent(options.symptom)
    }
    this.setData({
      crops: crops,
      stages: dict.stages,
      urgency: dict.urgency,
      cropIndex: cropIndex,
      crop: crops[cropIndex],
      stage: dict.stages[1],
      urgencyText: dict.urgency[0],
      symptom: symptom,
      symptomLen: symptom.length
    })
    this.refreshSubmit()
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadExperts()
  },

  getDict() {
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const d = mock.dictionaries()
      return { crops: d.crops, stages: d.stages, urgency: d.urgency }
    }
    return {
      crops: ['水稻', '小麦', '玉米', '番茄', '黄瓜', '辣椒', '苹果', '柑橘', '马铃薯', '大豆', '葡萄', '茶树'],
      stages: ['播种/育苗期', '苗期', '分蘖/伸长期', '开花期', '结果期', '成熟采收期', '采收后'],
      urgency: ['一般咨询（3 个工作日）', '较急（24 小时内）', '紧急（2 小时内）']
    }
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const r = mock.expertList()
    const list = r.list.map(e => ({
      id: e.id,
      name: e.name,
      avatar: e.avatar,
      field: e.field,
      online: e.online,
      onlineText: e.onlineText,
      ratingText: e.ratingText,
      selected: false
    }))
    this.setData({ experts: list })
    this.autoPickExpert(list)
  },

  // ---------- 云开发模式 ----------
  loadExperts() {
    wx.cloud.callFunction({
      name: 'expertOps',
      data: { action: 'list' }
    }).then(res => {
      const r = res.result || {}
      const list = (r.list || []).map(e => ({
        id: e.id,
        name: e.name,
        avatar: e.avatar,
        field: e.field,
        online: e.online,
        onlineText: e.onlineText,
        ratingText: e.ratingText,
        selected: false
      }))
      this.setData({ experts: list })
      this.autoPickExpert(list)
    }).catch(() => {
      wx.showToast({ title: '专家列表加载失败', icon: 'none' })
    })
  },

  // 默认选中第一位在线专家
  autoPickExpert(list) {
    if (this.data.expertId) {
      this.markExpert(this.data.expertId)
      return
    }
    const online = list.filter(e => e.online)
    const pick = online.length ? online[0] : (list[0] || null)
    if (pick) this.markExpert(pick.id)
  },

  markExpert(id) {
    const list = this.data.experts.map(e => ({
      id: e.id,
      name: e.name,
      avatar: e.avatar,
      field: e.field,
      online: e.online,
      onlineText: e.onlineText,
      ratingText: e.ratingText,
      selected: e.id === id
    }))
    const cur = list.filter(e => e.selected)[0]
    this.setData({
      experts: list,
      expertId: id,
      expertName: cur ? cur.name : ''
    })
    this.refreshSubmit()
  },

  pickExpert(e) {
    this.markExpert(e.currentTarget.dataset.id)
  },

  // ---------- 农技问诊 · 表单交互 ----------
  onCrop(e) {
    const i = Number(e.detail.value)
    this.setData({ cropIndex: i, crop: this.data.crops[i], errCrop: '' })
    this.refreshSubmit()
  },

  onStage(e) {
    const i = Number(e.detail.value)
    this.setData({ stageIndex: i, stage: this.data.stages[i] })
  },

  onUrgency(e) {
    const i = Number(e.detail.value)
    this.setData({ urgencyIndex: i, urgencyText: this.data.urgency[i] })
  },

  onSymptom(e) {
    const v = e.detail.value || ''
    this.setData({ symptom: v, symptomLen: v.length, errSymptom: '' })
    this.refreshSubmit()
  },

  onArea(e) {
    this.setData({ area: e.detail.value || '' })
  },

  onLocation(e) {
    this.setData({ location: e.detail.value || '' })
  },

  // 快捷症状标签：点击后追加到描述文本
  tapQuickTag(e) {
    const idx = Number(e.currentTarget.dataset.idx)
    const tags = this.data.quickTags.map((t, i) => {
      if (i !== idx) return t
      return { name: t.name, active: !t.active }
    })
    const picked = tags.filter(t => t.active).map(t => t.name)
    let text = this.data.symptom
    const joined = picked.join('、')
    // 首次点击时以标签快速起草描述，用户可继续编辑
    if (!text || this.lastAuto === text) {
      text = joined ? (joined + '。') : ''
      this.lastAuto = text
    }
    this.setData({
      quickTags: tags,
      symptom: text,
      symptomLen: text.length,
      errSymptom: ''
    })
    this.refreshSubmit()
  },

  // ---------- 图片 ----------
  addImage() {
    if (this.data.images.length >= 6) {
      wx.showToast({ title: '最多上传 6 张图片', icon: 'none' })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const f = (res.tempFiles && res.tempFiles[0]) || null
        if (!f) return
        const images = this.data.images.concat([{
          key: util.uid('img'),
          path: f.tempFilePath,
          emoji: ''
        }])
        this.setData({ images: images })
      },
      fail: () => {
        this.addPlaceholder()
      }
    })
  },

  // 模拟器无相机时，添加占位图，保证流程可演示
  addPlaceholder() {
    if (this.data.images.length >= 6) return
    const emoji = this.data.imageEmojis[this.data.images.length % this.data.imageEmojis.length]
    const images = this.data.images.concat([{
      key: util.uid('img'),
      path: '',
      emoji: emoji
    }])
    this.setData({ images: images })
    wx.showToast({ title: '已添加占位图（预览模式）', icon: 'none' })
  },

  delImage(e) {
    const key = e.currentTarget.dataset.key
    this.setData({ images: this.data.images.filter(i => i.key !== key) })
  },

  // ---------- 校验与提交 ----------
  refreshSubmit() {
    const s = util.validateSymptom(this.data.symptom)
    const c = util.validateCrop(this.data.crop)
    this.setData({ canSubmit: s.ok && c.ok && !!this.data.expertId })
  },

  submit() {
    if (this.data.submitting) return
    const c = util.validateCrop(this.data.crop)
    if (!c.ok) {
      this.setData({ errCrop: c.msg })
      wx.showToast({ title: c.msg, icon: 'none' })
      return
    }
    const s = util.validateSymptom(this.data.symptom)
    if (!s.ok) {
      this.setData({ errSymptom: s.msg })
      wx.showToast({ title: s.msg, icon: 'none' })
      return
    }
    if (!this.data.expertId) {
      wx.showToast({ title: '请选择一位接诊专家', icon: 'none' })
      return
    }
    const payload = {
      crop: c.value,
      stage: this.data.stage,
      urgency: this.data.urgencyText,
      symptom: s.value,
      area: (this.data.area || '').trim(),
      location: (this.data.location || '').trim(),
      expertId: this.data.expertId,
      imageCount: this.data.images.length
    }
    this.setData({ submitting: true })

    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const r = mock.createConsult(payload)
      this.setData({ submitting: false })
      this.afterSubmit(r)
      return
    }
    wx.cloud.callFunction({
      name: 'consultOps',
      data: { action: 'create', payload: payload }
    }).then(res => {
      this.setData({ submitting: false })
      this.afterSubmit(res.result || {})
    }).catch(() => {
      this.setData({ submitting: false })
      wx.showToast({ title: '提交失败，请检查网络', icon: 'none' })
    })
  },

  afterSubmit(r) {
    if (!r.success) {
      wx.showToast({ title: r.msg || '提交失败', icon: 'none' })
      return
    }
    wx.showModal({
      title: '提交成功',
      content: r.msg || '问诊已提交，专家将尽快接诊',
      confirmText: '查看详情',
      cancelText: '返回列表',
      success: res => {
        if (res.confirm && r.id) {
          wx.redirectTo({ url: '/pages/consult-detail/consult-detail?id=' + r.id })
        } else {
          wx.switchTab({ url: '/pages/consult/consult' })
        }
      }
    })
  },

  goIdentify() {
    wx.navigateTo({ url: '/pages/identify/identify' })
  },

  noop() {}
})
