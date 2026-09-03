// 农技问诊 · 云开发配置（病虫害识别与农技咨询）
// 说明：农技问诊 的 useMock=true 时使用本地 mock 数据，便于在开发者工具直接预览；正式上线后改为 false
module.exports = {
  appName: '农技问诊',
  tagline: '病虫害识别与农技咨询',
  envId: 'your-cloud-env-id',
  // 农技问诊 预览模式：true 时使用本地 mock，便于在无云环境时直接预览（病虫害识别与农技咨询）
  useMock: true,
  // 农技问诊 空状态演示：true 时列表返回空数组，用于验证空状态 UI；false 恢复完整业务数据
  mockEmpty: false
}
