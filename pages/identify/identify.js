// 拍照识别：选择/模拟图片 -> AI 识别结果 -> 保存识别记录
// AI 结果仅作辅助，页面全程标注「以专家/官方为准」
const util = require('../../utils/util.js')
const config = require('../../config.js')

// 无法真实拍照时（模拟器/无授权）使用的示例样本，避免流程中断
const SAMPLES = [
  { key: 's1', emoji: '🌾', name: '水稻叶片样本', crop: '水稻', hint: '叶片梭形斑点、中央灰白' },
  { key: 's2', emoji: '🍅', name: '番茄叶片样本', crop: '番茄', hint: '暗绿色水渍状斑块' },
  { key: 's3', emoji: '🌽', name: '玉米心叶样本', crop: '玉米', hint: '心叶孔洞、木屑状虫粪' },
  { key: 's4', emoji: '🥒', name: '黄瓜叶背样本', crop: '黄瓜', hint: '多角形黄斑、叶背霉层' },
  { key: 's5', emoji: '🍊', name: '柑橘枝梢样本', crop: '柑橘', hint: '黄梢、斑驳型黄化' },
  { key: 's6', emoji: '🌿', name: '田间杂草样本', crop: '水稻', hint: '疑似禾本科杂草' }
]

Page({
  data: {
    // 步骤：1 选图 / 2 识别中 / 3 结果
    step: 1,
    // 图片
    imagePath: '',
    imageEmoji: '',
    imageName: '',
    samples: SAMPLES,
    sampleKey: '',
    // 作物选择
    crops: [],
    cropIndex: 0,
    crop: '',
    // 补充描述
    hint: '',
    hintLen: 0,
    // 识别进度
    progress: 0,
    progressText: '',
    // 结果
    result: null,
    disclaimer: '',
    saved: false,
    // 历史
    history: [],
    showHistory: false
  },

  onLoad(options) {
    const crops = ['不确定'].concat(this.getCrops())
    let cropIndex = 0
    if (options && options.crop) {
      const c = decodeURIComponent(options.crop)
      const idx = crops.indexOf(c)
      if (idx >= 0) cropIndex = idx
    }
    this.setData({
      crops: crops,
      cropIndex: cropIndex,
      crop: crops[cropIndex]
    })
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadHistory()
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },

  getCrops() {
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      return mock.CROPS.slice()
    }
    return ['水稻', '小麦', '玉米', '番茄', '黄瓜', '辣椒', '苹果', '柑橘', '马铃薯', '大豆', '葡萄', '茶树']
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    const h = mock.identifyHistory()
    this.setData({ history: h.list })
  },

  // ---------- 云开发模式 ----------
  loadHistory() {
    wx.cloud.callFunction({
      name: 'identify',
      data: { action: 'history' }
    }).then(res => {
      const r = res.result || {}
      this.setData({ history: r.list || [] })
    }).catch(() => {})
  },

  // ---------- 选择图片 ----------
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const f = (res.tempFiles && res.tempFiles[0]) || null
        if (!f) return
        this.setData({
          imagePath: f.tempFilePath,
          imageEmoji: '',
          imageName: '已选择田间照片',
          sampleKey: '',
          step: 1,
          result: null,
          saved: false
        })
      },
      fail: () => {
        wx.showToast({ title: '未选择图片，可使用下方示例样本', icon: 'none' })
      }
    })
  },

  // 使用示例样本（模拟器环境下无法拍照时的兜底）
  pickSample(e) {
    const key = e.currentTarget.dataset.key
    const s = SAMPLES.filter(x => x.key === key)[0]
    if (!s) return
    const crops = this.data.crops
    let cropIndex = crops.indexOf(s.crop)
    if (cropIndex < 0) cropIndex = 0
    this.setData({
      imagePath: '',
      imageEmoji: s.emoji,
      imageName: s.name,
      sampleKey: key,
      cropIndex: cropIndex,
      crop: crops[cropIndex],
      hint: s.hint,
      hintLen: s.hint.length,
      step: 1,
      result: null,
      saved: false
    })
  },

  clearImage() {
    this.setData({
      imagePath: '',
      imageEmoji: '',
      imageName: '',
      sampleKey: '',
      result: null,
      step: 1,
      saved: false
    })
  },

  onCrop(e) {
    const idx = Number(e.detail.value)
    this.setData({ cropIndex: idx, crop: this.data.crops[idx] })
  },

  onHint(e) {
    const v = e.detail.value || ''
    this.setData({ hint: v, hintLen: v.length })
  },

  // ---------- 开始识别 ----------
  startIdentify() {
    if (!this.data.imagePath && !this.data.imageEmoji) {
      wx.showToast({ title: '请先拍照或选择一个示例样本', icon: 'none' })
      return
    }
    this.setData({ step: 2, progress: 0, progressText: '正在上传图片…', result: null, saved: false })
    this.runProgress()
  },

  // 模拟识别进度条，兼顾云模式的等待反馈
  runProgress() {
    const steps = [
      { at: 18, text: '正在上传图片…' },
      { at: 42, text: '图像预处理与病斑分割…' },
      { at: 68, text: '比对病虫害特征库…' },
      { at: 88, text: '计算候选结果置信度…' },
      { at: 100, text: '识别完成' }
    ]
    if (this.timer) clearInterval(this.timer)
    let p = 0
    this.timer = setInterval(() => {
      p += 4
      if (p > 100) p = 100
      let text = steps[0].text
      for (let i = 0; i < steps.length; i++) {
        if (p >= steps[i].at) text = steps[i].text
      }
      this.setData({ progress: p, progressText: text })
      if (p >= 100) {
        clearInterval(this.timer)
        this.timer = null
        this.fetchResult()
      }
    }, 60)
  },

  fetchResult() {
    const payload = {
      crop: this.data.crop,
      hint: this.data.hint,
      seed: this.data.sampleKey || this.data.imageName
    }
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const r = mock.identifySimulate(payload)
      this.setData({ step: 3, result: r.result, disclaimer: r.disclaimer })
      return
    }
    wx.cloud.callFunction({
      name: 'identify',
      data: { action: 'identify', payload: payload }
    }).then(res => {
      const r = res.result || {}
      if (r.success && r.result) {
        this.setData({ step: 3, result: r.result, disclaimer: r.disclaimer || '' })
      } else {
        this.setData({ step: 1 })
        wx.showToast({ title: r.msg || '识别失败，请重试', icon: 'none' })
      }
    }).catch(() => {
      this.setData({ step: 1 })
      wx.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
    })
  },

  reIdentify() {
    this.setData({ step: 1, result: null, saved: false })
  },

  // ---------- 保存识别记录 ----------
  saveRecord() {
    const r = this.data.result
    if (!r) return
    if (this.data.saved) {
      wx.showToast({ title: '该结果已保存', icon: 'none' })
      return
    }
    const record = {
      id: r.id,
      name: r.name,
      crop: r.crop,
      type: r.type,
      emoji: r.emoji,
      conf: r.conf
    }
    if (config.useMock) {
      const mock = require('../../mock/data.js')
      const res = mock.saveIdentify(record)
      this.setData({ saved: true })
      this.applyMock()
      wx.showToast({ title: res.msg, icon: 'success' })
      return
    }
    wx.cloud.callFunction({
      name: 'identify',
      data: { action: 'save', record: record }
    }).then(res => {
      const rr = res.result || {}
      if (rr.success) {
        this.setData({ saved: true })
        this.loadHistory()
        wx.showToast({ title: rr.msg || '已保存', icon: 'success' })
      } else {
        wx.showToast({ title: rr.msg || '保存失败', icon: 'none' })
      }
    }).catch(() => {
      wx.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    })
  },

  // ---------- 农技问诊 · 跳转 ----------
  goAsk() {
    const r = this.data.result
    const crop = r ? r.crop : (this.data.crop === '不确定' ? '' : this.data.crop)
    const symptom = r ? ('AI 初筛疑似「' + r.name + '」（置信度 ' + r.confText + '），请专家复核。' + (this.data.hint ? '补充：' + this.data.hint : '')) : this.data.hint
    wx.navigateTo({
      url: '/pages/ask/ask?crop=' + encodeURIComponent(crop) + '&symptom=' + encodeURIComponent(symptom)
    })
  },

  goKnowledge() {
    wx.switchTab({ url: '/pages/knowledge/knowledge' })
  },

  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  closeHistory() {
    this.setData({ showHistory: false })
  },

  // 查看相似病害：直接以该名称重新给出说明
  tapSimilar(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    wx.showModal({
      title: '相似对象：' + item.name,
      content: '作物：' + item.crop + '\n相似度：' + item.conf + '\n\n若田间症状与本项更接近，建议向专家提交问诊由人工复核。',
      confirmText: '去问诊',
      cancelText: '知道了',
      success: res => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/ask/ask?crop=' + encodeURIComponent(item.crop) })
        }
      }
    })
  },

  noop() {}
})
