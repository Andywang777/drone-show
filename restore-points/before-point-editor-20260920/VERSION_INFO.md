# 粒子空间 · 界面迭代 20260919

开发目录：/Users/andywang/Desktop/drone-formation-design-20260919
页面：http://127.0.0.1:4180/
启动：本目录运行 npm start，或在 Finder 双击“启动点阵飞行.command”。

恢复点：/Users/andywang/Desktop/drone-formation-dev-next-20260916（4179），本轮保持不变。
复制时 191 个文件逐一 SHA-256 校验，保留 Git 历史及未提交实现；不是另起项目。

本轮：形态检查 / 动画预览分离；循环预览、单次录制；左侧按素材类型精简。
继续工作先读 CODEX_HANDOFF.md。跨端口迁移工程请用“保存工程 / 打开”，浏览器自动保存不共享。

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
