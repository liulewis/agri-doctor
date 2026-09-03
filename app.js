// 农技问诊 · 小程序入口（病虫害识别与农技咨询）
// 农技问诊 负责云开发初始化与全局数据管理
// 农技问诊 · 小程序入口（病虫害识别与农技咨询）
// 农技问诊 负责云开发初始化与全局数据管理
// 农技问诊 · 小程序入口（病虫害识别与农技咨询）
// 农技问诊 负责云开发初始化与全局数据管理
const config = require('./config.js')

App({
  globalData: {
    envId: config.envId
  },
  onLaunch() {
    if (!wx.cloud) {
      return
    }
    wx.cloud.init({
      env: config.envId,
      traceUser: true
    })
  }
})
