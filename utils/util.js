// 农技问诊 · 业务工具函数：日期格式化、金额/面积/数量校验、数据聚合、导出等
// 农技问诊 各页面统一引用本模块，保证病虫害识别与农技咨询场景下的校验与格式化规则一致。

// ---------- 农技问诊 · 日期/周期工具 ----------
function formatMonth(d) {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  return y + '-' + m
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')
  return y + '-' + m + '-' + day
}

// 农技问诊 · 解析日期字符串（如病虫害识别与农技咨询相关日期），失败返回 null
function parseDate(str) {
  if (!str) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return isNaN(d.getTime()) ? null : d
}

// 给定月份生成起止日期字符串，用于病虫害识别与农技咨询相关的月度统计与区间查询
function monthRange(month) {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const next = m === 12 ? new Date(y + 1, 0, 1) : new Date(y, m, 1)
  return {
    start: month + '-01',
    end: formatDate(new Date(next.getFullYear(), next.getMonth(), 0))
  }
}

// ---------- 农技问诊 · 金额/数值工具 ----------
// 金额格式化（保留两位小数），适用于病虫害识别与农技咨询场景中的金额展示
function formatMoney(n) {
  const v = Number(n)
  if (isNaN(v)) return '0.00'
  return v.toFixed(2)
}

// 金额/单价校验：返回 { ok, value, msg }，用于病虫害识别与农技咨询相关输入校验
function validateAmount(input) {
  if (input === '' || input == null) return { ok: false, value: 0, msg: '请输入金额' }
  const s = String(input).trim()
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { ok: false, value: 0, msg: '金额格式不正确，最多两位小数' }
  }
  const v = Number(s)
  if (v <= 0) return { ok: false, value: 0, msg: '金额需大于 0' }
  if (v > 100000000) return { ok: false, value: 0, msg: '金额过大，请核对' }
  return { ok: true, value: v, msg: '' }
}

// 备注/描述校验：返回 { ok, value, msg }，控制病虫害识别与农技咨询相关备注长度
function validateNote(input) {
  const s = (input || '').trim()
  if (s.length > 50) return { ok: false, value: '', msg: '备注不超过 50 字' }
  return { ok: true, value: s, msg: '' }
}

// 农技问诊 · 名称校验：账户、分类、病虫害识别与农技咨询相关名称输入
function validateName(input, label) {
  const s = (input || '').trim()
  if (!s) return { ok: false, value: '', msg: '请输入' + (label || '名称') }
  if (s.length > 20) return { ok: false, value: '', msg: (label || '名称') + '不超过 20 字' }
  return { ok: true, value: s, msg: '' }
}

// 农技问诊 · 预算/租金/目标值校验（允许 0 表示不限制）
function validateBudget(input) {
  const s = String(input || '').trim()
  if (s === '') return { ok: true, value: 0, msg: '' }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { ok: false, value: 0, msg: '预算格式不正确' }
  }
  const v = Number(s)
  if (v < 0) return { ok: false, value: 0, msg: '预算不能为负' }
  if (v > 100000000) return { ok: false, value: 0, msg: '预算过大' }
  return { ok: true, value: v, msg: '' }
}

// ---------- 农技问诊 · 数据分组与聚合 ----------
// 按指定字段分组，返回对象形式的 Map，用于病虫害识别与农技咨询分类统计
function groupBy(list, keyFn) {
  const map = {}
  ;(list || []).forEach(item => {
    const k = keyFn(item)
    if (!map[k]) map[k] = []
    map[k].push(item)
  })
  return map
}

// 农技问诊 · 对指定字段求和，支持金额、面积、数量等累计统计
function sumBy(list, keyFn) {
  return (list || []).reduce((s, i) => s + (Number(keyFn(i)) || 0), 0)
}

// 农技问诊 · 安全取值，避免空对象或嵌套属性缺失导致页面异常
function safeGet(obj, path, fallback) {
  try {
    const parts = path.split('.')
    let cur = obj
    for (const p of parts) {
      if (cur == null) return fallback
      cur = cur[p]
    }
    return cur == null ? fallback : cur
  } catch (e) {
    return fallback
  }
}

// ---------- 农技问诊 · 数据导出 ----------
// 生成 CSV 文本，用于农技问诊的数据导出/分享
function toCSV(headers, rows) {
  const escape = v => {
    const s = (v == null ? '' : String(v))
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
    return s
  }
  const head = headers.map(h => escape(h.label)).join(',')
  const body = rows.map(r => headers.map(h => escape(safeGet(r, h.key, ''))).join(',')).join('\n')
  return head + '\n' + body
}

// 农技问诊 · 将记录对象转换为导出行（字段顺序固定）
function recordToRow(r) {
  return {
    date: r.date,
    type: r.type === 'income' ? '收入' : '支出',
    category: r.category,
    account: r.account || '默认账户',
    cropTag: r.cropTag || '',
    amount: r.amount,
    note: r.note || ''
  }
}

// ---------- 农技问诊：置信度与时间 ----------
// 将 0~1 的置信度转为百分比字符串（如 0.936 -> "93.6%"）
function fmtConfidence(n) {
  const v = Number(n)
  if (isNaN(v) || v < 0) return '0.0%'
  const pct = v <= 1 ? v * 100 : v
  return (Math.round(pct * 10) / 10).toFixed(1) + '%'
}

// 置信度整数百分比（用于进度条宽度绑定，避免 WXML 内计算）
function confPercent(n) {
  const v = Number(n)
  if (isNaN(v) || v < 0) return 0
  const pct = v <= 1 ? v * 100 : v
  return Math.max(0, Math.min(100, Math.round(pct)))
}

// 置信度等级：高 / 中 / 较低，用于给结果卡上色
function confLevel(n) {
  const p = confPercent(n)
  if (p >= 85) return '高'
  if (p >= 65) return '中'
  return '较低'
}

// 置信度等级英文 key（用于 class 绑定）
function confLevelKey(n) {
  const p = confPercent(n)
  if (p >= 85) return 'high'
  if (p >= 65) return 'mid'
  return 'low'
}

// 日期时间格式化：YYYY-MM-DD HH:mm
function formatDateTime(d) {
  const date = d instanceof Date ? d : new Date(d)
  if (isNaN(date.getTime())) return ''
  const hh = date.getHours().toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  return formatDate(date) + ' ' + hh + ':' + mm
}

// 相对时间：刚刚 / N分钟前 / N小时前 / N天前 / 具体日期
function relTime(input) {
  const date = input instanceof Date ? input : new Date(String(input).replace(/-/g, '/'))
  if (isNaN(date.getTime())) return String(input || '')
  const diff = Date.now() - date.getTime()
  if (diff < 0) return formatDate(date)
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return min + ' 分钟前'
  const hour = Math.floor(min / 60)
  if (hour < 24) return hour + ' 小时前'
  const day = Math.floor(hour / 24)
  if (day < 30) return day + ' 天前'
  return formatDate(date)
}

// 文本截断，超出部分以省略号结尾
function truncate(s, n) {
  const str = String(s == null ? '' : s)
  const max = Number(n) || 30
  if (str.length <= max) return str
  return str.slice(0, max) + '…'
}

// 阅读量友好显示：1234 -> 1.2k
function fmtViews(n) {
  const v = Number(n) || 0
  if (v < 1000) return String(v)
  return (Math.round(v / 100) / 10).toFixed(1) + 'k'
}

// 评分星级：返回长度 5 的数组，元素为 full / half / empty
function starsOf(rating) {
  const v = Math.max(0, Math.min(5, Number(rating) || 0))
  const arr = []
  for (let i = 1; i <= 5; i++) {
    if (v >= i) arr.push('full')
    else if (v >= i - 0.5) arr.push('half')
    else arr.push('empty')
  }
  return arr
}

// 类型 -> 样式 class（WXML 内不能做映射，统一在此预计算）
function typeKey(t) {
  if (t === '病害') return 't-bing'
  if (t === '虫害') return 't-chong'
  if (t === '草害') return 't-cao'
  if (t === '栽培') return 't-zai'
  return 't-def'
}

// 危害等级 -> 样式 class
function harmKey(h) {
  if (h === '极高') return 'h-max'
  if (h === '高') return 'h-high'
  if (h === '中') return 'h-mid'
  return 'h-low'
}

// ---------- 农技问诊：表单校验 ----------
// 症状描述校验：不少于 5 字，不超过 300 字
function validateSymptom(input) {
  const s = (input || '').trim()
  if (!s) return { ok: false, value: '', msg: '请描述作物的具体症状' }
  if (s.length < 5) return { ok: false, value: '', msg: '症状描述不少于 5 个字' }
  if (s.length > 300) return { ok: false, value: '', msg: '症状描述不超过 300 字' }
  return { ok: true, value: s, msg: '' }
}

// 作物选择校验
function validateCrop(input) {
  const s = (input || '').trim()
  if (!s) return { ok: false, value: '', msg: '请选择作物品种' }
  if (s.length > 20) return { ok: false, value: '', msg: '作物名称过长' }
  return { ok: true, value: s, msg: '' }
}

// 追问内容校验
function validateReply(input) {
  const s = (input || '').trim()
  if (!s) return { ok: false, value: '', msg: '请输入追问内容' }
  if (s.length > 200) return { ok: false, value: '', msg: '追问内容不超过 200 字' }
  return { ok: true, value: s, msg: '' }
}

// 生成本地唯一 id（预览模式下新增数据使用）
function uid(prefix) {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 46656).toString(36).padStart(3, '0')
  return (prefix || 'id') + '_' + t + r
}

// 数值限制在 [min, max] 区间
function clamp(n, min, max) {
  const v = Number(n)
  if (isNaN(v)) return min
  return Math.max(min, Math.min(max, v))
}

// 从数组中按稳定规则取一项（不依赖随机，保证预览一致性）
function pickBy(list, seedText) {
  const arr = list || []
  if (!arr.length) return null
  const s = String(seedText || '')
  let sum = 0
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i)
  return arr[sum % arr.length]
}

module.exports = {
  formatMonth: formatMonth,
  formatDate: formatDate,
  parseDate: parseDate,
  monthRange: monthRange,
  formatMoney: formatMoney,
  validateAmount: validateAmount,
  validateNote: validateNote,
  validateName: validateName,
  validateBudget: validateBudget,
  groupBy: groupBy,
  sumBy: sumBy,
  safeGet: safeGet,
  toCSV: toCSV,
  recordToRow: recordToRow,
  fmtConfidence: fmtConfidence,
  confPercent: confPercent,
  confLevel: confLevel,
  confLevelKey: confLevelKey,
  formatDateTime: formatDateTime,
  relTime: relTime,
  truncate: truncate,
  fmtViews: fmtViews,
  starsOf: starsOf,
  typeKey: typeKey,
  harmKey: harmKey,
  validateSymptom: validateSymptom,
  validateCrop: validateCrop,
  validateReply: validateReply,
  uid: uid,
  clamp: clamp,
  pickBy: pickBy
}
