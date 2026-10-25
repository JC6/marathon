# Marathon

浏览器马拉松小游戏，支持键盘、手机触控及横竖屏。

## 运行与验证

使用 Node.js 24：

```sh
npm ci
npm run dev
```

打开终端显示的地址。手机可在同一局域网通过开发机的局域网地址访问。

构建并预览：

```sh
npm run build
npm run preview
```

完整验证包含单元测试、构建和浏览器测试：

```sh
npx playwright install chromium webkit
npm run validate
```

Linux 缺少系统依赖时，改用 `npx playwright install --with-deps chromium webkit` 安装浏览器。

## 玩法

跑者自动前进，通过换道超越、冲刺和放慢恢复控制体力。每 5 km 设置补给，按界面提示换到对应跑道自动领取。

| 操作 | 键盘 | 手机 |
| --- | --- | --- |
| 左右换道 | ← / → | 左右按钮 |
| 冲刺 | 按住空格 | 按住冲刺 |
| 放慢恢复 | 按住 ↓ | 按住恢复 |
| 暂停 / 继续 | Esc | 暂停 / 继续按钮 |

切换窗口或隐藏页面时自动暂停，返回后手动继续。

记录仅保存在当前浏览器，不跨设备同步。刷新不保留进行中的比赛，清除浏览器数据会删除记录。

## 许可

代码和原创素材采用 [MIT](LICENSE)，第三方许可见 [THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt)。

产品和赛事名称的权利属于各自所有者，游戏与相关品牌、赛事无隶属或赞助关系。
