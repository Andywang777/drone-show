# 粒子空间 · 日期新版交接（2026-09-19）

## 接下来只在这里工作

- 当前开发目录：`/Users/andywang/Desktop/drone-formation-design-20260919`
- 新版地址：`http://127.0.0.1:4180/`，界面标记 `0919`。
- 启动：在本目录运行 `npm start`；也可在 Finder 双击 `启动点阵飞行.command`。聊天中的脚本链接可能只打开代码预览。
- 恢复点：`/Users/andywang/Desktop/drone-formation-dev-next-20260916`，端口 `4179`。本轮开始完整复制并 SHA-256 校验了 191 个文件，旧目录不再修改。Git 历史和原有未提交改动一并保留，本轮未提交 Git。
- 更早原型：`/Users/andywang/Desktop/drone-formation`（4178）；阶段二备份：`/Users/andywang/Desktop/drone-formation-backup-phase2-20260916`。
- 浏览器自动保存按端口隔离。将旧版中的工程“保存工程”导出，再到新版“打开”；复制代码不会复制浏览器自动保存。

## 产品方向与协作约定

给视效设计师把二维线稿或 GLB 三维素材转换成空间粒子动效，用于设计探索。保留无人机展示的克制位移、规则布点特点，不做飞控工具。
- 少参数、预设优先；相关需求先讨论成组，再集中实现与测试。
- 三阶段：入场 / 持续动态 / 退场，默认 1.5 + 2 + 1.5 = 5 秒。总时长与各阶段双向联动，跳过阶段不计入缩放。
- 只保留总数输入，不增各元素占用或剩余额度管理。裁掉背面是真实不布点，不能用占位关灯冒充节省；多元素自动分配尚未实现。
- 不重复通读规格、参考素材或历史代码；先 git status --short、git diff --stat 和相关片段。大规模读取或查看素材前问用户。
- 图片先缩到最长边 1200，一次只看一张；元信息能回答则不看图。工具输出设置上限。简短汇报。
- 不自行分派子代理。不要修改恢复点或旧版本；当前对话若工作区仍指向旧目录，写入新目录可能需要沙箱授权，不绕过。

## 本轮已完成：界面 0919

1. 顶部“形态检查 / 动画预览”模式按钮。默认形态检查，静态显示当前实际布点，采用基础色和远近明暗，不受动画的位移、闪烁、变色、退场熄灯影响。
2. “动画预览 / 播放完整片段 / 重播”从头播放；可暂停、拖动进度；默认勾选循环。关闭循环后，播放结束自动恢复形态检查。
3. 编辑布点、切换素材、打开项目回到形态检查；编辑动效自动预览（尊重 reduced-motion）。模式和循环是临时视图状态，不写入工程。
4. 视频始终从头录一遍，即使勾选循环；录制中禁用模式/循环/编辑，结束恢复形态检查。图片导出当前显示模式。所有导出继续去掉摄像机标记和参考网格。
5. 左侧按素材类型显示：二维才有线条识别与采样；三维网格才有布点方式与参考模型；三维才有观众设置；导入二维失败的待处理素材仍显示阈值重试控件。上传入口始终保留。

## 沿用功能与实现位置

- `app.js`：事件、工程状态、工作任务、模式切换；`index.html` / `style.css`：原生界面，无构建依赖。
- `animation/preview.mjs`：本轮新增，循环步进、形态检查帧、按素材类型显示面板；对应 `tests/preview.test.mjs`。
- `animation/motion.mjs`：所有预设，无状态采样；方向渐入/熄灭、聚合、小幅扩散、漂浮、波浪、分层/分区/星点闪烁、整体/分层变色（冷/暖/多彩）。已删除大幅翻转退场，旧工程 flip 自动转 fade。
- `viewport/view.js`：Three.js、OrbitControls、清晰无光晕圆点、深度明暗、观众空心线框/角落标识、clean 导出渲染。检查相机近观众位置时隐藏空间标记，避免遮挡。
- `geometry/audience.mjs`：完整/前三分之二/前半部。`f.points` 为真实保留点，`audienceSource` 为可恢复编辑源，不参与实际渲染。球体比例有测试，其他模型是深度平面裁切。
- `formation.mjs`：球体经纬行列；两极减少每圈数量，公共经线槽位，总数精确。
- `geometry/mesh-layout.mjs`：GLB 默认“轮廓优先 · 横竖网格”。固定观众正交投影，约 35% 边界，其余规则网格落在最近可见表面，精确数量。保留“表面均匀”；旧工程需主动更新。
- `geometry/generate.mjs` / `jobs/`：后台生成、取消计算。保留旧间距算法测试，但设计界面没有安全间距或锁点控制。
- `project/model.mjs` / `persistence.mjs`：验证、撤销、存储、旧工程迁移；`media.js`：PNG/JPG 和浏览器支持格式的视频录制。

## 验证与限制

- `npm test`：49 项测试通过（原 46 项 + 本轮 3 项）。检查了 app.js / viewport/view.js 语法、git diff --check。
- 浏览器验收结果见本文件末尾的收尾记录。未重读图片视频素材，未进行逐像素视觉验收。
- 轮廓优先是观众可见表面的浮雕式布点，不是完整隐蔽背面或模型折线提取。极薄投影/高复杂度会明确报错，保留原点阵。
- 无整体模型旋转控件；观众位置/目标使用素材局部坐标，跟随现有平移。绕检查视角不重排布点。
- 尚未做：二维局部上色（下一阶段候选，先矩形框选）、三维套索、多元素自动数量分配、观众视角小窗、方案 A/B 对比、动效图示卡片。不要把讨论建议当成已实现。

## 新对话建议首条消息

继续 `/Users/andywang/Desktop/drone-formation-design-20260919` 粒子空间项目。先读取本目录 CODEX_HANDOFF.md，再只做 git status、git diff --stat 和必要代码片段阅读。旧版 4179 是恢复点，不修改。不要重新通读规格或素材，大规模读取先问我。先根据我的体验反馈继续小步迭代。

## 本轮收尾验证（已完成）

- 新版实际目录运行 npm test：49/49 通过；语法检查及 git diff --check 通过。
- 浏览器验证：默认形态检查；示例球体隐藏二维识别/采样及模型专属控件；切换动画预览后循环超过一轮仍在播放；关闭循环并重播后自动回到形态检查。
- 勾选循环时测试录制：模式与循环开关禁用，仅录制完整 5 秒，页面提示视频已生成并请求下载，随后恢复形态检查；控制台无错误。未逐帧审看视频文件。
- 原 4179 目录代码与复制前散列一致，只有 Finder 的 .DS_Store 元数据变化，没有回写旧版代码。
- 新版服务本轮已启动；新会话若无法连接 4180，请在正确目录运行 npm start，不要误开旧版端口。

## 小步更新 v2026.09.19.1

页头和浏览器标题显示完整版本号；新建素材持续动态默认为分层交替闪烁，保存的动效不覆盖。光点直径从 0.23 调为 0.30（约增大 30%，保持清晰边缘）；图形整体尺寸不变。界面将“粒子形态”改为“图形与布点”，“整体大小”改为“图形整体尺寸”，避免与光点尺寸混淆。

## 小步更新 v2026.09.19.2

光点显示尺寸从 0.30 增至 0.45（再增大 50%），不改变点位或图形尺寸。整体尺寸标签明确为“图形最长边（米，保持比例）”，增加点间距由尺寸、总数和布点方式决定的说明；显示光点不代表机身尺寸或安全间距。

## 小步更新 v2026.09.19.3

二维导入默认沿线等距：中心线细化、连通路径追踪、按长度分配点数；少点优先长笔画，不含语义识别或显式尖角锚点。自动推断深浅背景及阈值，可手动调整。按 UV 采原图颜色，转换线性 RGB 后与动效亮度结合；可取消“沿用原图颜色”使用统一色，颜色动效仍可覆盖。旧点阵不自动重排，请选沿线等距再更新。新增 geometry/strokes.mjs、tests/strokes.test.mjs。龙头原图 1000 点已做离线布局图检查，四色和主轮廓可辨；未完成浏览器视觉验收。

## 小步更新 v2026.09.19.4

新增入场“沿线生长”，仅二维沿线布点可选。按生成器保存的笔画路径顺序逐点扫亮，保持点位不动；长笔画先画，不是语义笔顺。非沿线素材如保存有该动效则渐亮回退。密度自适应仍待讨论：现有布点按长度分配，未实现曲率加密或语义重要性识别。

## 小步更新 v2026.09.19.5

按难易分步实施二维动效：已增加持续“沿线流光”（保留 22% 底亮度，亮带沿已有顺序走一遍，阶段首尾全亮）和退场“沿线退隐”（同生长顺序逐点熄灭）。不移动点位，保留原图颜色，依赖二维 strokes 布点。非对应布局回退静止/渐暗。待后续：色彩接力、分笔画接力、局部呼吸、中心/左右起点路径传播；不把现有索引顺序描述为连通语义路径。

## 小步更新 v2026.09.19.6

持续动态新增“原图色彩接力”：按原图近似色相分组，中性色独立，实际存在的颜色组依次提亮；保留 22% 底亮度，首尾恢复全亮，不改变原色或点位。仅二维且沿用原图颜色时可选；单色保持稳定，关闭原图颜色时回退静止。颜色分类缓存按颜色缓冲引用，工程仅新增动效枚举，无存储结构变化。后续仍待：分笔画接力、局部呼吸、可选起点生长。

## 一次性完成剩余动效 v2026.09.19.7

新增入场“分笔画接力”、持续“局部呼吸”，沿线生长增加默认/中心/左端/右端起点。strokeIds 保存每点笔画分组；旧线稿须点击更新图形与布点，UI 对缺少分组的数据禁用新起点/分笔画接力并提示。路径沿同笔画边连接，端点按最近邻接力，不增可见连接点；不连通分量自动桥接延迟。中心选最近点、左右选极值点，路径按距离扩散；非语义笔顺。沿线流光/退隐沿用所选起点顺序。局部呼吸自动选部分笔画，其他保持稳定，不含手动圈选。工程存取含分组与起点；新增 animation/stroke-routing.mjs 及测试。龙头1000点三起点离线计算约8–9ms，未浏览器视觉验收。密度自适应、手动起点和手动局部区域未实现，不属于本批动效范围。

## 分镜第一版 v2026.09.19.8

底部分镜条最多12幕；当前素材加入、独立复制、移除、拖动排序，点击切换中央静态检查；静态正面缩略图。project.storyboard 可选字段含id/formationId/transition，支持工程存取及撤销；旧工程初始无分镜，素材不丢失。转场支持熄灭换形（暗场实际插值移动）和点阵变形（递归空间排序一一匹配，颜色插值）；缓存按素材快照失效。连接接管相邻入场退场，场景原5秒保留，将省去的阶段时间用于持续动态；两幕5+2+5=12秒。全片单次预览及单转场预览；视频仍只录当前幕。不同实际点数暂阻止全片预览并提示手动统一，不自动补点或关闭多余点；全局数量一键同步尚未实现。分镜可多次引用同一素材，修改会同步；复制分镜生成独立素材。路径匹配未做防碰撞或最优航程保证。新文件 animation/storyboard.mjs、storyboard-ui.js、tests/storyboard.test.mjs。独立4181测试不影响4180用户自动保存。

## 分镜连接修正 v2026.09.19.9

TRANSITIONS 注册表统一转场策略/名称/校验/UI选项。dark 熄灭换形：保留前幕完整退场、后幕完整入场，中间全暗换位；单连接预览覆盖退出+换位+进入。morph 连续变形：仅跳过该连接朝向的两边，不再把省去时间塞入持续动态。总时长按实际有效阶段+连接时长求和，混用按每个边独立处理；单幕设置和预览不改。两幕默认dark为12秒，morph为9秒。页面显示连接阶段与暗场/变形时长标签。旧工程dark/morph键兼容。

## 粗线密度调整 v2026.09.19.10

沿线等距新增原掩膜局部线宽估计；仅清理厚笔画端点到交叉点、长度小于局部半宽0.8倍的短毛刺，不清理独立短笔画。采样后以目标平均弧长间距的28%做全局近邻合并，优先保留短笔画点；释放点数补到最长可用弧段，保留UV原色、笔画分组和排序。空间不足则报错保留旧点阵，禁止重复挤点。新增 geometry/stroke-spacing.mjs，版本 .10；旧素材需更新图形与布点。龙头1000点离线验证精确总数、有限坐标，无重合，最小距离约0.099场景单位；未浏览器视觉验收。未增加参数或改变光点显示大小。

## 可见疏密设置 v2026.09.19.11

“图形与布点”新增全片光点小/中/大（0.28/0.45/0.62）和“自动统一疏密（全部素材）”。旧工程默认不改尺寸，需主动勾选；勾选即时缩放现有实际点位，后续导入/重生成提交也规范化，无需重新导入。典型间距目标1.25场景米，并对10%分位间距按显示大小保守放大，不保证所有图形密度完全一致或消除投影重叠。最近邻使用KD树缓存，UI显示典型间距与局部重叠风险。总数、UV、原色、分组、ID保留，隐藏编辑源同步缩放；整体尺寸输入自动模式禁用，关闭后可手动调，关闭不恢复原尺寸（撤销可恢复）。project.visual 持久化，自动模式采用所有素材共同画幅/正面相机尺度，非按每幕单独缩放；相机仍可手动拖动。新 geometry/visual-density.mjs 和测试。

## v2026.09.20.1 - fixed size and active point budget

Replaces .11 auto-scaling: geometry size remains unchanged. In auto-density mode 2D stroke sampling uses target arc spacing and generation.pointBudget as a ceiling; nearby samples are merged without forcing refill. Other shapes use deterministic spatial filtering of stored source points. UI shows actual lights / budget. Turning auto off and regenerating restores count-based generation. Previously enlarged sizes cannot be inferred or automatically restored; adjust the size field manually.

Unequal-count transitions now use max(Na,Nb) lanes with zero color at inactive endpoints. Morph fades spare lanes in/out; dark relocation remains unlit. These are preview lanes anchored at active positions, not physical reserve-drone parking or safe flight trajectories. Removed equal-count blocker. 75 tests pass, including scale preservation, budget, undo/save, unequal transition endpoints. Syntax and diff checks pass; browser visual verification pending.

## v2026.09.20.2 - stroke color and dot visibility

Source color sampling now examines a 5x5 neighborhood, rejects paper/transparent pixels using foreground settings, and selects stronger interior color constrained to similar hue (neutral strokes remain neutral). Used consistently for viewport, thumbnails and transitions. No arbitrary saturation boost. Dot presets now 0.35/0.58/0.75; default medium increased from0.45. Auto spacing fixed0.85, independent of dot preset. Dot changes preserve points and count; no geometry regeneration required to see color/size improvement. Added color bleed and size-independence tests.

## v2026.09.20.3 - 2D point preparation editor

Added right-hand Point Editing / Animation Design tabs. 2D material switches/imports enter static edit mode. Single-point screen selection (12px hit radius), XY drag with pointer capture, Escape cancel, numeric XY fields, previous/next selection, arrow keys (0.1, Shift1), delete, undo. Rotation/pan disabled during edit; zoom retained. Points keep source UV/color when moved; delete filters aligned metadata and compacts stroke IDs. Last point cannot be deleted.

manualEdited persisted; auto-density skips edited geometry, so save/load/other edits do not regenerate it. Explicit regenerate asks before overwriting, clears manual flag, remains undoable. Full/current animation turns editing off. 2D edits apply to the material: scenes referencing the same material share changes; duplicate scene for independent edits. New files project/point-edit.mjs, viewport/point-editor.js, point-editor-ui.js. Compact right panel retains feature area; full visual/icon redesign and region color editing not included. Restore files: restore-points/before-point-editor-20260920 (only files touched in this iteration).

## v2026.09.20.4 - compact workspace

Keeps left materials, central viewport, right point/motion tabs and bottom storyboard/playback. Compact CSS overrides, restrained card styling and color accents, side panels scroll internally. Image/model upload controls are side-by-side. Static help text becomes keyboard-focus/hover/click info buttons with viewport-positioned tooltips; dynamic status/error text remains visible. Count and shape size share a row. Background/export collapsed. Desktop body does not scroll; narrow/mobile fallback still permits scrolling. Added compact-ui.js. Full point editor remains from .3, restore point before .3 also covers base layout files.
