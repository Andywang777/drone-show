# DroneShow Studio 架构评估与实施提案

日期：2026-09-15。状态：待用户确认；本轮未修改应用代码。

## 0. 范围、依据与验证

- 当前应用：`/Users/andywang/Desktop/drone-formation`。
- 交接目录：`/Users/andywang/Desktop/万里 2026 下/跨学科 3-2026 下/跨学科2026下-灯光秀/DroneShow_Codex_Handoff`。该目录只有规范和参考素材，不是另一个应用代码库。
- 已阅读 CODEX_BRIEF、PRODUCT_SPEC、UI_SPEC、交接 README、现有全部自有源码、测试、启动配置和项目文档；检查了 vendor 依赖入口与文件清单，未对第三方压缩库逐行审计。
- 已查看 UI 概念图；参考视频为 42.68 秒、2218×1440、60 fps。以每 5 秒抽帧覆盖全片，并放大查看 12、20、32 秒关键画面。视频审阅基于画面与字幕，未进行音轨转写。
- 本轮重新运行 `npm test`，9/9 通过。该结果是现有算法回归结果，不等于浏览器、性能或飞行安全验证。
- 当前目录没有 Git 仓库；旧 docs/design.md、plan.md、verification.md 仍主要描述最初 1000 点版本，部分记录已落后于代码。
- 按用户本次要求，只提交评估与计划。交接文件中“之后开始实现”的一般指引不覆盖“等架构确认后再实现”的明确要求。

## 1. 结论

保留 Three.js 渲染、现有 GLB 解析、表面采样、栅格线稿基础和媒体导出；先抽出统一 Formation、项目状态、任务与时间求值层，再逐步增加 2.5D、安全、转场及编辑器界面。

项目目前是一个可用的单编队演示器。它已经共享位置数组和渲染，但尚未建立可保存、可复用、有稳定点身份的领域模型。第一步应解决数据所有权，而不是继续向 app.js 添加按文件类型分支。

第一可用里程碑应完成：真实二维龙图 → 500 点 → 2.5D → 拖动厚度 → 间距优化/不可行提示 → 保存 Formation → 厚度/RGB 关键帧与基础效果 → 预览 → 当前帧与时间区间安全报告。

500 架、8 m、示例龙和概念图中的安全数值都是演示数据，不能成为系统常量或伪造状态。交接包没有独立可用于验收的龙线稿；概念截图不能当作干净的源图，后续需准备独立样例。

## 2. 当前架构

```text
启动点阵飞行.command / npm start
  └─ server.mjs：本地静态服务
       └─ index.html + style.css：全部控件、启动自检
            └─ bootstrap.js
                 └─ app.js：状态、事件、导入、渲染、动画总控
                      ├─ GLTFLoader + Draco + Meshopt
                      │    └─ formation.mjs：readSurface → sampleTriangles
                      ├─ lineart.mjs：decodeLineArt → readInk → sampleInk
                      ├─ formation.mjs：preset / launchGrid / interpolate
                      ├─ THREE.Points：一个当前点阵
                      └─ media.js：背景、PNG/JPG、MediaRecorder
```

### 技术与限制

- 原生 JavaScript ES Modules、HTML/CSS、import map；无 React/Vue、无 TypeScript 编译、无打包步骤。
- 本地 Three.js 0.185.0、WebGL2、OrbitControls；Node 内置 HTTP 和 node:test。
- 无后端业务服务、数据库、保存格式、撤销栈、Worker、统一任务取消机制。
- 主要状态为 app.js 闭包中的 target/from/count/progress/modelSurface/lineInk 等变量；控件值也兼任状态来源。
- 只保留最新一个 GLB 与最新一张线稿；没有多 Formation 集合。
- 所有采样与模型烘焙同步发生在主线程；改变点数会重新采样已缓存 GLB，即使当前显示的是线稿。
- GLB 限 100 MB、200 万三角形；只允许内嵌资源。线稿限 20 MB、4000 万输入像素，采样前最长边缩到 1024。
- 1–10000 的数量范围是输入限制，尚没有证明万架下的编辑、计算和录制性能。
- 世界默认 Y 向上，线稿位于 XY 平面、Z=0。采样直接缩到 22 个世界单位并抬高到 Y=15；尺寸和场景位置混在生成器内。
- 播放只有 0–1 进度和单段时长；动画按数组下标对应，从地面阵列飞往当前目标。没有编队间指派。
- 灯光为所有点共享一个材质颜色；当前没有逐点 RGB、UV、组和效果层。
- 图片/视频是视觉输出，没有 droneId/time/XYZ/RGB 的规范轨迹输出。视频依赖实时播放，切后台取消，不适合作为规范轨迹采样时钟。

## 3. 可保留模块及改造边界

| 模块 | 保留内容 | 需要调整 |
|---|---|---|
| formation.mjs/readSurface | 默认姿态、世界变换、蒙皮/形变/实例的三角形烘焙和面积累计 | 保留 submesh、源三角形、法线、UV 等来源信息；公共输出改为普通数组结构；重计算进任务层 |
| sampleTriangles | 面积加权、分层、确定性抽样 | 作为候选点生成器；分离物理尺寸/世界位置，增加间距重分布和特征权重 |
| lineart.mjs | 图像解码、透明度/深浅阈值、确定性采样 | 解码与纯算法分离；保留完整源图/UV；增加轮廓、填充、距离场、背景处理 |
| preset | 球形、螺旋、立方体生成公式 | 接入统一生成器；参数化尺寸和数量；保留为回归样例 |
| launchGrid | 演示起飞布局 | 物理版本改为由最小间距和场地边界决定，不再为“放入画面”自动缩小间距 |
| interpolate | 平滑 easing 和演示动画 | 可保留为明确标记的旧演示模式；不当作安全转场求解器 |
| app.js 渲染部分 | Renderer、Points、光斑纹理、相机、网格、资源释放 | 拆到 Viewport；对象生命周期由渲染适配器管理；增加选中/警告/逐点颜色缓冲 |
| media.js | 背景合成、PNG/JPG、可用的浏览器录制 | 拆 Background、ImageExport、VideoExport；不再通过 aside DOM 批量锁控件；消费共享项目时间 |
| index/style/bootstrap | 深色变量、基础控件、启动提示、WebGL 失败反馈 | 按工作站布局拆 UI；保持旧功能可访问；错误统一进入应用状态 |
| server/启动脚本 | 本地运行与离线资源 | 继续用于开发，后续补格式 MIME/资源打包规则；不引入业务后端 |
| tests/samples | 9 项纯算法测试、有效/无效 GLB 样例 | 扩展契约、安全、撤销保存、时间轴和浏览器回归 |

## 4. 需求差距

| 领域 | 当前 | V1 缺口 |
|---|---|---|
| 项目 | 刷新丢失 | 新建/打开/保存/自动保存/撤销重做、米秒单位、机队、围栏 |
| 输入 | GLB、PNG/JPG/WebP、三种预设 | GLTF 外部资源包、OBJ/STL/PLY、SVG、文字、更多图元、来源分组 |
| 2D | 对阈值内像素区域抽样 | 轮廓/填充/混合、边缘检测、源图叠加、源图颜色映射、文字可读性 |
| 3D | 表面积采样 | 特征/轮廓优先、体积、混合权重、原始尺寸控制 |
| 点生成 | 数量精确但无距离约束 | 最小间距、物理尺寸、锁点、密度笔刷、稳定重采样、不可行报告 |
| 2.5D | 无 | 深度场、手柄、方向、平滑、深度笔刷、Z 优先优化、厚度关键帧 |
| Formation/Group | 当前数组和类型选择器 | 多编队 CRUD、点 ID、组、显隐锁定、选取、变换 |
| Transition | 地面到目标的下标插值 | 指派、轨迹规划、速度/加速度约束、全过程距离验证 |
| Timeline | 单进度条 | 多轨、片段、关键帧、时间码、缩放、吸附、循环、标记 |
| RGB/Effects | 统一 RGB | 每点/组/编队颜色、HSV/亮度、图像/空间映射、顺序效果叠加 |
| Safety | 无 | 静态/动态距离、速度、加速度、高度、围栏、定位冲突 |
| Export | PNG/JPG/实时无声视频 | 按持久 droneId 导出的轨迹、RGB、时间戳、版本与安全报告 |
| UI | 左控件/右视图/播放栏 | 层级/中央视口/右检查器/常驻多轨时间轴/状态栏 |
| 音频 | 无 | MP3/WAV、波形、标记与共享时间同步（P1） |

视频值得借鉴的是源图与生成点阵分开、预处理结果可检查、比例与数量可见、上色与最终夜景可切换。视频中的模态窗口不应照搬；以 UI_SPEC 的常驻属性面板和时间轴为准。

## 5. 建议的目标架构

### 技术路线

第一阶段继续原生 ES Modules + Three.js，新增 JSDoc 类型契约及运行时校验，保留无需构建的启动方式。不在第一阶段同时迁移 UI 框架和算法；后续若工作站 UI 维护确有需要，可独立迁移视图层，核心模块不依赖 UI 框架。

```text
UI（层级/视口工具/检查器/时间轴）
          │ Commands / Selection
          ▼
Application（ProjectStore / UndoRedo / TaskManager / Revision）
          │
          ├─ Asset adapters → NormalizedSource → Generators
          │                                  → PointSet/Formation
          ├─ Geometry/Relief/Redistribution
          ├─ Timeline evaluator → Transition/Transform/Lighting
          │                                  → EvaluatedFrame
          ├─ Safety evaluator ← 同一帧与同一轨迹求值器
          └─ Persistence / Export adapters

Viewport：只把 EvaluatedFrame 映射到 Three.js 缓冲和工具覆盖层
Workers：耗时采样、深度优化、匹配、完整安全扫描
```

建议目录边界（提案，尚未创建）：

- `core/`：类型、数值约定、点集、坐标变换，不引用 DOM/Three.js 对象。
- `assets/`：各格式 adapter；输出 raster/vector/mesh/pointCloud/text/procedural 描述。
- `geometry/`：候选点、轮廓、采样、特征、空间索引、约束重分布。
- `relief/`：深度场、平滑、笔刷、Z 约束。
- `project/`：状态、命令、事务、历史、版本与持久化。
- `timeline/`：轨道、片段、关键帧、时间求值。
- `transitions/`：指派与轨迹生成分开，供安全模块独立验证。
- `lighting/`：基础色、映射、效果顺序合成。
- `safety/`：静态与区间检测、阈值、报告。
- `viewport/`、`ui/`：渲染与交互。
- `jobs/`：Worker 协议、进度、取消、旧结果丢弃。
- `export/`：规范轨迹、视觉媒体、未来厂商 adapter。

关键规则：

1. UI 发命令，不直接修改点缓冲；Three.js 场景不是项目数据库。
2. 重计算先生成草稿，成功且 revision 未改变才原子提交；取消/失败不污染现有 Formation。
3. 每个任务携带 project/formation revision。修改形状、约束或关键帧后，相关轨迹/安全缓存立即过期。
4. 撤销存命令或缓冲差异；拖动手柄过程是一个交互事务，松开只形成一个历史步骤。
5. `evaluate(project, time)` 不依赖上一帧，不在播放中重新随机采样；拖动时间、实时播放、离线导出得到同一结果。

## 6. 数据模型提案

### 实体与职责

| 实体 | 核心字段 | 约束 |
|---|---|---|
| Project | schemaVersion、id、name、revision、units、worldFrame、fleet、bounds、constraints、assetIds、formationIds、timelineId | 持久化根；不存 DOM/材质 |
| Fleet/Drone | droneId、数量、初始/停留位置、动力学参数 | droneId 跨整场演出稳定 |
| Asset | id、type、name、blobRefs、sourceHash、importSettings、normalizedSourceRef | 原始资源与生成结果分开；一个素材可产生多个编队 |
| Formation | id、revision、name、sourceAssetId、spatialMode、pointSetRef、generation、relief、defaultTransform、groupIds、visible、locked | 定义静态造型和生成配方，不带独立播放时钟 |
| PointSet | pointIds、localPositions、UV、sourceElementIds、baseColors、lockMask、metadata | TypedArray 运行时存储，所有数组长度契约一致 |
| Group | id、formationId、name、pointIds、visible、locked | 引用逻辑点 ID，不能引用易变数组下标 |
| Relief | planeFrame、fieldRef、method、direction、thicknessM、smoothing、brushMaskRef、perPointDepthCorrection | 原始 XY/UV 不破坏；厚度可动画 |
| Timeline/Track | duration、timebase、tracks、markers、loopRange | 全项目共享秒制时钟；导出另声明帧率 |
| FormationClip | id、formationId、formationRevision、start、duration、droneBindings | 持有造型；复用同一 Formation 可有多个 clip |
| Transition | fromClipId、toClipId、duration、assignmentMode、constraints、bindings、trajectoryRef、inputRevision、solveStatus | 映射和轨迹独立；修改输入后失效 |
| KeyframeChannel | target、propertyPath、keys(time/value/interpolation) | 支持 position/rotation/scale/thickness/RGB/brightness/effect 参数 |
| Lighting | baseColor/pointColors、orderedEffectLayers | 层含 target、start/end、parameters、opacity、blend、enabled、seed |
| SafetyReport | inputHash/revision、scope、timeRange、constraints、method/tolerance、status、metrics、conflicts | 区分未检查/计算中/通过/不通过/无法判定/已过期 |
| ExportJob | projectRevision、range、sampleRate、coordinateTransform、format、reportRef、status | 输出绑定快照，不能在导出中混入编辑后的数据 |

### 两种 ID 必须分开

- `pointId` 是编队内部的逻辑位置身份；重新生成时通过锁定规则和稳定匹配尽量保留。
- `droneId` 是整场演出的无人机身份；FormationClip/Transition 负责它与 pointId 的绑定。
- 厚度/颜色动画不改变 pointId。改变拓扑或点数时明确产生新 revision，并使相关组/指派/报告得到校验或失效提示。

### 机队数量与不同编队点数

概念图同时出现 500/300/800/200 点编队和“总机数 500”，不能直接作为合法项目。

建议：素材库里的 Formation 可以有不同点数；第一条可验证演出链路使用与项目机队等量的编队。片段点数不一致时，提示重新采样到机队数量。后续可增加显式 reserve/parking 队列，多余无人机仍有位置、灯光和安全轨迹，不能在转场中消失。超过机队数量的 clip 必须处理后才能进入可导出序列。

### 坐标与投影

建议沿用右手系、Y-up，米/秒为产品单位；2D 使用局部 XY 平面，Z 为局部厚度轴。保存 planeFrame 的原点和基向量，后续通过导出 adapter 转轴，避免重写当前渲染。

“保持正面轮廓”第一版严格定义为保持参考平面内 XY，即正交正视投影保持。有限距离透视观众视角下改变深度仍会改变屏幕轮廓，若要严格保持该投影，需要另一个沿视线约束模式，不能混称已经支持。

### 持久化

运行时大数组与可编辑元数据分离。工程保存采用版本化 manifest + 原始资源/点缓冲/深度场；自动保存放 IndexedDB，显式保存提供可携带工程包。URL.createObjectURL 仅运行时生成，不作为资产持久引用。打开时验证 schema、资源完整性及引用；缓存可重建，已确认点集和关键帧必须可恢复。

## 7. 2.5D 与安全的核心设计

### 深度表示

平面坐标为 (u,v)，位置为 `origin + u*axisU + v*axisV + depth*normal`。

- 基础深度使用平滑标量场 f(u,v)，通过方向和厚度映射到 [0,T]、[-T,0] 或 [-T/2,T/2]。
- 第一版智能浮雕指可解释的图像/轮廓距离场与平滑启发式，不承诺单图真实三维重建。
- 亮度、边缘、中心鼓起、低频噪声是不同 field generator，使用同一输出契约。
- 笔刷存对深度场的局部修改及遮罩，预留 push/pull/smooth/flatten，不对每帧重新随机赋 Z。
- Z 安全修正为逐点 correction，与基础深度场分开；同 XY 的点无法靠单值 f(u,v) 获得不同深度，必须显式分层修正或在生成阶段去重。

### 数量、尺寸与间距

给定数量、形状尺寸、锁点、最小距离和厚度，问题可能不可行。结果应返回满足约束、未收敛/不可判定或明确不可行原因，不得以重叠点凑数并显示“安全”。

对于投影距离 r 小于最小距离 d 的点对，需要 `|Δz| ≥ sqrt(d²-r²)`。若可用厚度不足，严格锁 XY 的 Z 优化无法解决。此时建议增加尺寸/厚度、减少数量，或由用户允许小范围 XY 重分布；不静默改变约束。

生成器先获得足量候选点，再进行距离约束选点/优化；保留锁点与重点区域。精确点数是目标，距离合规需要单独报告。

### 厚度动画的特殊风险

8 m 厚度下通过距离检查，不代表平面 0 m 也通过。0→8→0 必须检测整个区间，同时计算运动速度/加速度。优化不能在每帧重新换层，否则可能出现位置跳跃；使用固定身份和连续深度轨迹。不满足约束时保留可编辑草稿并显示冲突。

### 转场与安全

- 指派仅决定每架机飞向哪个点；“最短距离”不代表无碰撞。
- 指派器接收距离、结构、交叉与冲突代价；轨迹器处理时间和动力学；独立 validator 审核结果。
- 中小规模评估精确指派，大规模评估分区/多尺度/局部改进；具体阈值由基准测试决定。
- 静态用空间邻域索引；时间区间先用扫掠边界筛选，再检查近邻的连续轨迹。
- 分段线性轨迹可算每段相对运动的最小距离；曲线需有误差边界的细分或保守界限。只在固定帧上采样不能据此宣称全过程安全。
- 高度/围栏/速度/加速度检查覆盖所有活动机和 reserve 机；灯光熄灭不代表该机不参加安全计算。
- 报告必须绑定输入版本和检测精度；尚无足够证据时状态为“无法判定”，不能默认绿灯。

## 8. 时间、灯光和导出

每个时间点统一求值：

1. 解析 Formation/Transition clip 和无人机绑定。
2. 求形状及深度，再求 clip 的变换；转场使用同一世界坐标端点和约束。
3. 按基础色与有序效果层计算逐 drone RGB；颜色空间、混合顺序和最终编码统一声明。
4. 生成 EvaluatedFrame：time、droneIds、worldPositions、RGB、可选速度/加速度。
5. Viewport 显示；Safety 验证；Export 按显式时间序列取相同结果。

RGB 编辑可输入 0–255 sRGB；合成内部统一用约定色彩空间和浮点精度，导出声明 RGB 编码。随机效果使用可重现 seed/time/ID，不依赖调用次数。

轨迹规范导出优先 JSON manifest + 分块数据（小例可 CSV）：droneId、timestamp、XYZ、RGB，附单位、坐标系、采样率、项目/算法版本和安全报告。未来厂商格式只做 adapter。PNG/JPG/视频继续作为独立视觉导出保留。

## 9. 工作站 UI

- 左：场景/素材/Formation/Group；中：持续存在的 3D 视口；右：上下文检查器；下：可调整高度的常驻时间轴；底：实时状态。
- 工作区“造型/编队/动画/灯光/检查/导出”只切工具和检查器，不销毁视口或清空选择/时间。
- 2.5D 检查器：数量与名称 → 空间模式 → 厚度数值/滑杆/关键帧菱形 → 方法/方向/平滑 → 投影约束 → 间距与优化 → 实际安全状态。
- 前/侧/自由相机、正交/透视、厚度手柄、变换工具、点/组选择和冲突覆盖层按里程碑递增。
- 状态栏显示真实计算结果；尚未实现的轨道不填假数据。概念图里的多编队、音频波形等在相应阶段由真实数据驱动。
- 保留已有背景与导出入口；窄屏将面板折叠，不用桌面面板挤满画布。

## 10. 分阶段计划与验收

### 阶段 1：统一数据与现有功能迁移

工作：建立 Project/Asset/Formation/PointSet 契约、ID、局部/世界坐标分离、命令事务、版本；把 GLB/线稿/预设接到相同 Formation 管线；抽 Viewport 和媒体服务。建立 Git 基线与更新文档，补基本保存/加载和可撤销编辑。

验收：导入 GLB 与线稿可以保存成两个独立编队；切换不丢数据；修改 A 不影响 B；数量/RGB/背景/播放/PNG/JPG/录制继续可用；失败导入不改现有项目；工程重开恢复已保存点集与资源；核心契约和回归通过。此阶段不承诺完整工作站 UI 或安全转场。

### 阶段 2：物理尺寸、2D 生成与静态间距

工作：尺寸单位、目标点数、outline/fill/混合基础、UV/颜色来源、空间索引、间距重分布和锁点契约；Worker 进度/取消/版本丢弃。

验收：真实龙线稿生成 500 点；可设物理尺寸和最小距离；有可行及不可行样例；不能以重复点凑数冒充安全；锁点保持；取消无部分提交；无关 Formation 不重新计算。

### 阶段 3：2.5D 编辑与工作站基础布局

工作：深度场、厚度/方向、中心/亮度/平滑智能浮雕基础、手柄、前侧视图、Z 优先优化；笔刷数据契约及至少 push/flatten 基础交互；层级、检查器、常驻时间轴区域和真实状态栏。

验收：2D↔2.5D 可逆；厚度数值与拖动一致；0 厚度还原基准平面；正交正视 XY 保持；锁点语义明确；侧视图可看出厚度；优化成功/失败均显示实测结果；拖动撤销一次恢复。

### 阶段 4：统一时间轴、关键帧、基础灯光与区间检查（首个可用里程碑）

工作：Formation hold clip、秒制求值、厚度/变换/RGB/亮度关键帧，基础色及渐变/扫描/呼吸，当前帧与时间区间安全报告；其他效果参数接同一通道机制。

验收：龙图 500 点，完成平面→浮雕→平面与 RGB/效果动画；任意拖动到同一时刻与顺播一致；深度动画全程检查距离、速度、加速度和边界；冲突可定位；工程保存/重开无损。示例通过时才显示通过，不可行例子必须明确失败。

阶段 1–4 合起来达到交接文档的首个可用纵向闭环，不能把阶段 1 的架构抽取单独称为已经完成首个里程碑。

### 阶段 5：多编队转场与规范轨迹导出

工作：机队绑定、指派器、轨迹生成器、约束求解与独立 validator；Transition 轨道；droneId/time/XYZ/RGB 规范输出及安全报告。

验收：两个等机队规模编队有明确 hold/transition 区间；报告匹配数量、全过程最小距离、速度和加速度；故意交叉与时长不足例子能报错；编辑任一端点会使旧结果失效；规范导出重新读取后对应采样时刻的位置和颜色一致。

### 阶段 6：补齐 V1 P0 范围

工作：SVG/文字与字形模式、GLTF/OBJ/STL/PLY、更多图元；分组/选择/变换、完整深度方法及笔刷、图像/空间色彩映射、其余 V1 基础效果；项目管理与导出体验完善。候选采样算法按测试逐步替换，不另建每种格式的动画管线。

验收：各格式均转成公共 Formation；材质/来源信息在支持范围内保留；所有输入共享时间、颜色、安全和导出；用户可对组操作；已有 GLB/线稿项目可迁移打开。

### 阶段 7：P1 与规模优化

工作：MP3/WAV/波形/标记、特征采样、轨迹优化、较大机队性能；完善恢复、长项目存储和离线媒体导出。音频扩展已有同一时间轴，不新增独立时钟。

验收：音频跳转/播放同步，导出策略清楚；基准记录硬件、输入、耗时、内存、帧率；取消与长时运行不过量保留资源。协作云端、节点灯光编辑器和额外厂商导出不进入当前 V1 核心范围。

## 11. 技术风险与性能关注

1. **几何可行性**：固定投影、有限厚度、精确数量和距离可能冲突；必须可报告不可行，不能保证任何图都满足任意约束。
2. **高密度输入**：当前 10000 点地面布局邻距约 25/99≈0.253 世界单位；为视口自动压缩布局与物理最小间距目标相反。
3. **网格内存**：200 万三角形仅 Float64 顶点坐标约 144 MB，尚未计累计面积、原网格、JS 临时数组和参考模型副本；文件大小不能代表峰值内存。
4. **时间展开成本**：以 5000 架、120 秒、30 Hz、每点 XYZ float32 + RGB uint8 粗算，仅位置颜色约 270 MB，未含 ID/时间/对象开销。要分块求值/流式输出，不保留整场逐帧对象。
5. **安全/指派规模**：朴素两两检查随点数平方增长；需要邻域、空间/时间粗筛和分区求解。不能将 10000 的输入上限理解为实时求解保证。
6. **线程迁移**：当前 readSurface 依赖 Three.js 节点，不能直接把场景图传 Worker；导入适配器需明确烘焙边界，再转移普通几何缓冲。
7. **状态漂移**：当前 pendingLineName/lineImage/lineInk 可代表不同导入尝试，需区分草稿与已提交；控件锁定当前由多个模块各自操作，迁移为任务状态派生。
8. **源图细节**：1024 缩放与按像素抖动可能丢细线、聚点；轮廓拓扑、孔洞和锁区是独立测试重点。
9. **颜色/安全缓存**：参数、世界缩放或编队重采样后，旧映射与报告不可继续复用。
10. **媒体输出**：实时视频帧率与窗口大小、主线程性能相关；规范轨迹输出不能依赖 MediaRecorder。现有功能保留但不提升为安全证据。

建议基准集合为 500/1000/3000/5000 点，10000 作为压力测试。首里程碑优先在实际开发机器验证 500 点交互；记录预览延迟、优化耗时、取消延迟与内存峰值后，再承诺性能门槛。

## 12. 测试计划

| 层 | 必测内容 |
|---|---|
| 几何导入 | 世界变换/蒙皮/实例/非均匀缩放、空退化网格、三角形与 UV 来源、坐标/单位一致 |
| 2D | alpha、深浅阈值、孔洞/断线、细线、实心图、比例/Y 翻转、轮廓与填充模式、颜色/UV 对齐 |
| 点集契约 | 精确数量、有限坐标、唯一 ID、锁点保持、组引用、重采样结果可复现 |
| 间距 | 与小规模暴力基准比对、刚好阈值边界、重合点、不可行约束、取消与失败回滚 |
| 2.5D | 零厚度、正/负/对称范围、XY 不变、平滑/笔刷/锁区、同 XY 分层、厚度动画连续性 |
| 转场 | 指派一一映射、droneId 不变、端点准确、不同数量拒绝/显式处理、路径交叉、短时长超速超加速度 |
| 连续安全 | 两端安全但中间碰撞、采样帧之间碰撞、曲线误差边界、围栏穿越、静止机/熄灯机仍参与检查 |
| Timeline | clip 边界、step/linear/easing、旋转插值、seek 与顺播一致、循环、同时间键处理、多个目标通道优先级 |
| Lighting | 层顺序、颜色空间、混合/强度、组目标、seed 再现、亮度限制、预览/导出一致 |
| 项目状态 | 新建/保存/加载、schema 升级、缺失资源、undo/redo、拖动单事务、旧 Worker 结果不得覆盖新状态 |
| 导出 | 时间戳顺序、坐标转换、ID/RGB 完整、重读对照、报告版本、失败/过期状态可见 |
| 浏览器 | 双类型导入、保存重开、手柄与关键帧、背景、PNG/JPG/视频、错误反馈、面板缩放、实际帧率 |

## 13. 建议确认的架构决策

1. 保留原生 JS/Three.js，以统一数据层渐进迁移；先不整体换框架。
2. 内部统一米/秒、Y-up、局部 XY + 深度轴；厂商坐标通过 adapter 转换。
3. 首条演出链路使用与机队等量的编队；不同点数先提示重新采样，reserve 队列后续显式实现。
4. 首个里程碑为阶段 1–4 的真实 2D→2.5D→关键帧→灯光→区间检查闭环；更多格式不抢在它之前。
5. “安全通过”只来自对应版本的实际验证；无法满足约束保留草稿并清楚解释，不自动减机或偷偷改变 XY。

等待用户确认后，从阶段 1 开始实现。
