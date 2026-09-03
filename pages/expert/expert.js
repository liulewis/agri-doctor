// 专家：列表 + 详情（同页两种模式，带 ?id= 时直接进入详情）
// 双模式：config.useMock -> mock/data.js；否则 wx.cloud.callFunction('expertOps')
const util = require('../../utils/util.js')
const config = require('../../config.js')

Page({
  data: {
    // list / detail
    mode: 'list',
    // 列表
    list: [],
    allList: [],
    keyword: '',
    // 排序方式
    sorts: [
      { key: 'rating', name: '综合评分' },
      { key: 'served', name: '接诊量' },
      { key: 'online', name: '在线优先' }
    ],
    sortKey: 'rating',
    // 领域筛选
    fields: ['全部', '水稻', '小麦', '玉米', '蔬菜', '果树'],
    fieldIndex: 0,
    field: '全部',
    countText: '',
    // 头部统计
    heroCount: 0,
    heroRating: '—',
    heroOnline: 0,
    // 详情
    id: '',
    detail: null,
    loading: true,
    // 服务说明
    services: [
      { icon: '💬', title: '图文问诊', desc: '上传照片与描述，专家 24 小时内给出方案' },
      { icon: '📞', title: '电话连线', desc: '复杂田块问题可预约 15 分钟语音沟通' },
      { icon: '🚜', title: '到田服务', desc: '规模种植可申请专家实地踏田会诊' }
    ]
  },

  onLoad(options) {
    if (options && options.id) {
      this.setData({ mode: 'detail', id: options.id })
    }
  },

  onShow() {
    if (config.useMock) { this.applyMock(); return }
    this.loadData()
  },

  onPullDownRefresh() {
    if (config.useMock) { this.applyMock() } else { this.loadData() }
    setTimeout(() => wx.stopPullDownRefresh(), 500)
  },
// ---------- 农技问诊 · 本地预览模式（mock） ----------
  applyMock() {
    const mock = require('../../mock/data.js')
    if (this.data.mode === 'detail') {
      const r = mock.expertDetail(this.data.id)
      this.renderDetail(r)
      return
    }
    const r = mock.expertList()
    this.renderList(r)
  },

  // ---------- 云开发模式 ----------
  loadData() {
    this.setData({ loading: true })
    if (this.data.mode === 'detail') {
      wx.cloud.callFunction({
        name: 'expertOps',
        data: { action: 'detail', id: this.data.id }
      }).then(res => {
        this.renderDetail(res.result || {})
      }).catch(() => {
        this.setData({ loading: false })
        wx.showToast({ title: '专家信息加载失败', icon: 'none' })
      })
      return
    }
    wx.cloud.callFunction({
      name: 'expertOps',
      data: { action: 'list' }
    }).then(res => {
      this.renderList(res.result || {})
    }).catch(() => {
      this.setData({ loading: false })
      wx.showToast({ title: '专家列表加载失败', icon: 'none' })
    })
  },

  renderList(r) {
    const list = (r.list || []).map(e => ({
      id: e.id,
      name: e.name,
      avatar: e.avatar,
      title: e.title,
      org: e.org,
      field: e.field,
      crops: e.crops || [],
      rating: e.rating,
      ratingText: e.ratingText,
      stars: e.stars || util.starsOf(e.rating || 0),
      served: e.served,
      servedText: e.servedText,
      respond: e.respond,
      online: e.online,
      onlineText: e.onlineText,
      tagsList: (e.tagsList || []).slice(0, 3),
      fieldText: util.truncate(e.field || '', 26)
    }))
    // 头部统计（预计算，WXML 内不做运算）
    const n = list.length
    const sum = list.reduce((s, e) => s + (Number(e.rating) || 0), 0)
    const onlineCount = list.filter(e => e.online).length
    this.setData({
      allList: list,
      loading: false,
      heroCount: n,
      heroRating: n ? (sum / n).toFixed(1) : '—',
      heroOnline: onlineCount
    })
    this.filterList()
  },

  renderDetail(r) {
    if (!r.success || !r.detail) {
      this.setData({ loading: false, detail: null })
      return
    }
    const d = r.detail
    this.setData({
      detail: Object.assign({}, d, {
        yearsText: d.years + ' 年从业',
        priceText: (typeof d.price === 'number' && d.price > 0) ? ('¥' + d.price) : (d.price || '公益免费')
      }),
      loading: false
    })
    wx.setNavigationBarTitle({ title: d.name + ' · 专家主页' })
  },

  // ---------- 列表筛选 / 排序 ----------
  filterList() {
    const k = (this.data.keyword || '').trim()
    const f = this.data.field
    let list = this.data.allList.slice()
    if (f !== '全部') {
      list = list.filter(e => (e.field + e.crops.join('')).indexOf(f) >= 0)
    }
    if (k) {
      list = list.filter(e => (e.name + e.org + e.field + e.tagsList.join('')).indexOf(k) >= 0)
    }
    const key = this.data.sortKey
    if (key === 'rating') {
      list.sort((a, b) => b.rating - a.rating)
    } else if (key === 'served') {
      list.sort((a, b) => b.served - a.served)
    } else {
      list.sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
    }
    this.setData({
      list: list,
      countText: '共 ' + list.length + ' 位农技专家'
    })
  },

  onKeyword(e) {
    this.setData({ keyword: e.detail.value || '' })
    this.filterList()
  },

  clearKeyword() {
    this.setData({ keyword: '' })
    this.filterList()
  },

  pickSort(e) {
    this.setData({ sortKey: e.currentTarget.dataset.key })
    this.filterList()
  },

  pickField(e) {
    const i = Number(e.currentTarget.dataset.idx)
    this.setData({ fieldIndex: i, field: this.data.fields[i] })
    this.filterList()
  },

  // ---------- 农技问诊 · 跳转 ----------
  openDetail(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ mode: 'detail', id: id, loading: true, detail: null })
    if (config.useMock) { this.applyMock() } else { this.loadData() }
    wx.pageScrollTo({ scrollTop: 0, duration: 200 })
  },

  backToList() {
    this.setData({ mode: 'list', detail: null, id: '' })
    wx.setNavigationBarTitle({ title: '农技专家' })
    if (config.useMock) { this.applyMock() } else { this.loadData() }
  },

  askExpert(e) {
    const id = (e.currentTarget.dataset.id) || this.data.id
    const d = this.data.detail
    const crop = d && d.crops && d.crops.length ? d.crops[0] : ''
    wx.navigateTo({
      url: '/pages/ask/ask?crop=' + encodeURIComponent(crop) + '&expertId=' + id
    })
  },

  goConsultDetail(e) {
    wx.navigateTo({ url: '/pages/consult-detail/consult-detail?id=' + e.currentTarget.dataset.id })
  },

  callExpert() {
    wx.showModal({
      title: '电话连线',
      content: '电话连线需先提交图文问诊，专家接诊后会在问诊详情内发起语音沟通邀请。',
      confirmText: '去问诊',
      cancelText: '知道了',
      success: res => {
        if (res.confirm) this.askExpert({ currentTarget: { dataset: { id: this.data.id } } })
      }
    })
  },

  goIdentify() {
    wx.navigateTo({ url: '/pages/identify/identify' })
  },

  noop() {}
})
