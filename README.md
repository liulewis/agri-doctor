# 农技问诊（微信云开发小程序）

> 农作物病虫害智能诊断与农技专家咨询平台——拍照识病、AI 问诊、专家在线答疑。

## 项目简介

- **产品定位**：面向农户与农业技术人员的病虫害诊断小程序。支持拍照识别作物病害、知识库检索、在线向专家咨询。
- **技术栈**：微信小程序原生（WXML / WXSS / JS）+ 微信云开发（云函数 + 云数据库）。
- **交付形态**：9 个前端页面 + 4 个云函数 + 1 个工具层 + 1 个 mock 数据层。
- **运行模式**：`config.useMock=true` 走本地 mock 数据预览；`false` 时通过 `wx.cloud.callFunction` 调用云函数。

## 目录结构

```
agri-doctor/
├── app.js / app.json / app.wxss          # 全局逻辑与配置
├── config.js                             # 云开发环境 ID（需修改）
├── project.config.json / sitemap.json
├── pages/                                # 9 个前端页面
│   ├── index                             # 首页
│   ├── identify                          # 拍照识病
│   ├── consult / consult-detail          # 咨询列表与详情
│   ├── expert                            # 专家列表
│   ├── article / knowledge                # 科普文章与病害知识库
│   ├── ask                               # 在线问诊
│   └── mine                              # 个人中心
├── cloudfunctions/                       # 4 个云函数
│   ├── consultOps                        # 咨询业务
│   ├── expertOps                         # 专家业务
│   ├── identify                          # 病害识别
│   └── knowledgeOps                      # 知识库检索
└── utils/                                # 工具层 + mock 数据
```

## 本地预览

当前模式为 **本地 mock 数据预览**，无需开通云开发环境即可运行。

1. 微信开发者工具打开项目目录
2. 修改 `config.js` 中的云开发环境 ID（上线时填写真实 envId）
3. 顶部栏切换「调试」→「不校验合法域名」
4. 点击编译即可预览

## 上线流程

1. `config.useMock` 设为 `false`
2. `config.js` 填写正式云开发环境 ID
3. 确认云数据库集合权限（云函数依赖 `OPENID` 做数据隔离）
4. 微信开发者工具 → 上传 → 提交审核

## 注意事项

- 云数据库 `.limit()` 查询上限为 100，分页查询需自行处理。
- 身份识别依赖 `cloud.getWXContext().OPENID`，勿自行传入用户信息。
- WXML 模板中 `{{ }}` 插值不支持箭头函数。