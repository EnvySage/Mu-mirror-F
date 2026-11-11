import currentCatalog from './achievementCatalog.json' with { type: 'json' }

// Frontend design edition. The account catalog and its 34 server rules remain separate.
// Plating challenge conditions intentionally live only in the design document.
const sets = [
  ['M', '镜面接线室', '从第一次接通，到找到适合自己的模型。', [
    ['镜面通电', 'MIRROR LINK', '成功测试、保存并启用第一份对话模型配置。', 1],
    ['记忆引擎', 'MEMORY CORE', '启用记忆检索配置，让第一条获准进入记忆的内容就绪。', 1],
    ['双路信号', 'DUAL SIGNAL', '使用两份不同的已保存模型配置，各完成一次有效对话。', 2],
    ['备用频道', 'SECOND CHANNEL', '保存一份备用模型配置，并成功测试连接。', 1],
    ['校准完成', 'CALIBRATED', '分别完成对话模型与记忆检索模型的连接测试。', 2],
    ['各司其职', 'RIGHT CONNECTION', '为对话与记忆检索配置各自可用的模型，完成一次记忆问答。', 2],
    ['自如切换', 'SAFE SWITCH', '切换到备用配置后完成对话，再切回原配置完成对话。', 2],
    ['长明之镜', 'STEADY SIGNAL', '在 30 个不同日期使用自己配置的模型完成有效对话。', 3],
  ]],
  ['R', '日常留痕', '一件小事、一页日常，慢慢连成自己的时间。', [
    ['此刻入档', 'FIRST TRACE', '成功保存第一条记录，仅保存的记录也计入。', 1],
    ['七日有迹', 'SEVEN MARKS', '在 7 个不同日期各保存至少一条记录。', 2],
    ['长页留影', 'LONG RECORD', '累计保存 30 条记录。', 2],
    ['一日三记', 'THREE TRACES', '在同一天保存 3 条记录。', 1],
    ['补上一笔', 'SECOND DRAFT', '重新打开一条仅保存的记录，补充原文并保存。', 1],
    ['月历有光', 'THIRTY DAYS', '在 30 个不同日期留下记录。', 2],
    ['日子成册', 'LIVING VOLUME', '在 3 个不同月份留下记录。', 3],
    ['四季来信', 'FOUR SEASONS', '在一年中的四个季度都留下属于自己的记录。', 3],
  ]],
  ['D', '回声频道', '从一句问候，到把散落的线索重新连起来。', [
    ['第一声回响', 'FIRST CONTACT', '获得第一次完整的 AI 回复。', 1],
    ['日常对谈', 'DAILY SIGNAL', '累计完成 20 轮有效对话，分布在至少 5 个不同日期。', 2],
    ['旧日回声', 'ECHO RETURN', '打开并载入一段有完整回复的往日会话。', 1],
    ['循迹而来', 'FOLLOW THE TRACE', '从对话的记录引用中打开一条原始记录。', 1],
    ['记得这件事', 'MEMORY ANSWERS', '获得一次带有本人记忆引用的有效回答。', 2],
    ['说到做到', 'WORDS TO ACTION', '从对话中确认一项行动提案，并成功执行。', 2],
    ['持续有声', 'RETURNING VOICE', '在 30 个不同日期完成有效对话。', 3],
    ['线索交汇', 'THREADS CONNECT', '在一次会话中获得记录与资产引用，并分别打开原始来源。', 3],
  ]],
  ['K', '记忆织网', '让镜子记住你认可的内容，也学会你的语言。', [
    ['记忆显影', 'MEMORY TRACE', '首次确认一条记录片段进入长期记忆，并完成就绪。', 1],
    ['教镜子一个词', 'WORD ARCHIVE', '手动添加或确认第一个个人词典项。', 1],
    ['私语共振', 'ECHO MATCH', '让一个已确认的个人词条进入对话上下文，并获得有效回复。', 2],
    ['词语标本', 'FIVE WORDS', '确认 5 个不同的个人词典项。', 2],
    ['同一种语言', 'WORD CONNECTION', '为一个个人词条补充别名并保存。', 1],
    ['有据可查', 'SOURCE FOUND', '从一个词典项的依据入口打开原始记录。', 1],
    ['亲手校对', 'MEMORY REVISED', '修改候选记忆片段后，主动确认它进入长期记忆。', 2],
    ['私人记忆库', 'PERSONAL LIBRARY', '让 100 条本人确认的记录片段进入长期记忆并就绪。', 3],
  ]],
  ['P', '行动航线', '把想法放进待办，让完成留下可以追溯的足迹。', [
    ['念头落地', 'FIRST PLAN', '首次登记一条待办，可手动创建或确认 AI 建议。', 1],
    ['三事已毕', 'TASK COMPLETE', '完成 3 条不同的待办。', 2],
    ['让建议变成行动', 'ACTION APPROVED', '确认一项 AI 行动提案，并执行成功。', 2],
    ['自己的航标', 'OWN DIRECTION', '手动创建一条待办，并填写具体描述。', 1],
    ['调整航线', 'COURSE CORRECTION', '修改一条待办的内容或状态并保存。', 1],
    ['来处与去处', 'LINKED ACTION', '从待办的来源入口查看它对应的原始记录。', 2],
    ['行动成列', 'THIRTY DONE', '完成 30 条不同的待办。', 3],
    ['稳步向前', 'STEADY PROGRESS', '在 12 个不同自然周中完成待办。', 3],
  ]],
  ['C', '时光回廊', '翻一页总结，也重新遇见走过的日子。', [
    ['当日回信', 'DAILY ECHO', '首次展开一篇已生成的每日总结全文。', 1],
    ['七日回望', 'WEEKLY REVIEW', '展开 7 个不同日期的每日总结全文。', 2],
    ['重访旧日', 'OLD DATE', '从时间日历打开一条至少创建于 30 天前的记录。', 2],
    ['翻过一页', 'CALENDAR TURN', '在时间日历切换月份，并打开当月的一条记录。', 1],
    ['循日寻迹', 'DATE FOUND', '通过日历的日期入口查看指定日期的记录。', 1],
    ['昨日有回声', 'YESTERDAY AGAIN', '在次日展开前一天的每日总结。', 1],
    ['三十封回信', 'THIRTY ECHOES', '展开 30 个不同日期的每日总结全文。', 3],
    ['时间的长廊', 'LONG CORRIDOR', '通过日历查看分属 6 个不同月份的记录。', 3],
  ]],
  ['REF', '自我显影', '保留此刻的自己，也看见变化是怎样发生的。', [
    ['此刻的画像', 'FIRST REFLECTION', '成功生成第一份个人画像。', 1],
    ['月候叠影', 'MONTHLY LAYERS', '为 3 个不同月份成功生成月度画像。', 3],
    ['两次之间', 'DOUBLE EXPOSURE', '查看两份不同画像快照的对比结果。', 2],
    ['读懂镜面', 'CLOSER LOOK', '展开并完整查看一份已生成的画像。', 1],
    ['回到那时', 'OLD REFLECTION', '从画像档案中打开一份历史快照。', 1],
    ['看见变化', 'VISIBLE CHANGE', '对比两份间隔至少 30 天的画像快照。', 2],
    ['半年的轮廓', 'HALF YEAR', '为 6 个不同月份成功生成月度画像。', 3],
    ['自己的年轮', 'YEAR IN MIRROR', '为 12 个不同月份成功生成月度画像。', 3],
  ]],
  ['T', '星轨收藏', '从偶然的一张牌，到一整片属于你的星图。', [
    ['偶然回声', 'ARCANA DRAW', '完成第一次每日抽牌。', 1],
    ['星轨七日', 'STAR PATH', '在 7 个不同日期完成每日抽牌。', 2],
    ['大阿卡纳同席', 'MAJOR ARCANA', '通过每日抽牌收藏全部 22 张不同的大阿卡纳。', 3],
    ['牌面的另一侧', 'BOTH SIDES', '在收藏中分别查看一张牌的正位与逆位释义。', 1],
    ['重逢的星', 'CARD REUNION', '在每日抽牌中再次遇见一张已经收藏的牌。', 1],
    ['月下三十回', 'MOON CYCLE', '在 30 个不同日期完成每日抽牌。', 2],
    ['星图渐满', 'CONSTELLATION', '通过每日抽牌收藏 40 张不同的塔罗牌。', 3],
    ['世界的回响', 'ARCANA WORLD', '通过每日抽牌收藏完整的 78 张塔罗牌。', 3],
  ]],
  ['V', '私人档案馆', '收藏有用的材料，也让它们在需要的时候出现。', [
    ['收藏第一件', 'FIRST ARCHIVE', '确认归档第一份记忆资产。', 1],
    ['十件私藏', 'TEN RELICS', '累计确认归档 10 份不同的记忆资产。', 2],
    ['失物归位', 'FOUND AGAIN', '打开一次由对话检索找到的已归档资产。', 2],
    ['翻开档案', 'OPEN ARCHIVE', '从资产列表预览一份已归档文件。', 1],
    ['读过再收好', 'REVIEWED FILE', '检查提取出的文件片段，确认后完成归档。', 1],
    ['材料相互照亮', 'LINKED RELICS', '在同一段对话中打开两份不同的资产引用。', 2],
    ['档案成列', 'THIRTY RELICS', '累计确认归档 30 份不同的记忆资产。', 3],
    ['随手可得', 'LIVING ARCHIVE', '在 12 个不同日期，通过对话找到并打开自己的资产。', 3],
  ]],
  ['G', '生长刻度', '自己定义进步，再为每一步留下具体的记录。', [
    ['成长有据', 'FIRST GROWTH', '首次向成长账本加入一条已确认的成长记录。', 1],
    ['三维显影', 'THREE AXES', '在 3 个不同成长维度各留下一条已确认记录。', 2],
    ['用自己的刻度', 'PERSONAL SCALE', '首次记成长分前，自定义并保存至少一个成长维度。', 1],
    ['为进步命名', 'NAMED GROWTH', '为一个尚未计分的成长维度设置自己的名称与说明。', 1],
    ['再向前一步', 'NEXT STEP', '在同一个成长维度的 3 个不同日期留下记录。', 2],
    ['五向生长', 'FIVE DIRECTIONS', '在 5 个不同成长维度各留下一条已确认记录。', 2],
    ['三十个脚印', 'THIRTY STEPS', '累计确认 30 条不同的成长记录。', 3],
    ['长成自己的样子', 'OWN HORIZON', '在 6 个不同月份留下成长记录。', 3],
  ]],
  ['S', '生活光谱', '从情绪、类型与数据里，看见生活的不同切面。', [
    ['情绪折光', 'MOOD SPECTRUM', '在已确认的记忆片段中留下 5 种不同情绪。', 2],
    ['生活有几面', 'MANY FACETS', '在已确认的记忆片段中使用 4 种不同内容类型。', 2],
    ['留一份副本', 'BACKUP LOG', '成功导出一次 JSON 或 Markdown 数据。', 1],
    ['看见心情', 'MOOD VIEW', '使用情绪筛选，打开一条符合该情绪的记录。', 1],
    ['按线索找回', 'SIGNAL FOUND', '使用内容类型筛选，打开一条匹配的记录。', 1],
    ['词语的经纬', 'TAG THREAD', '给记录添加自由标签，再用该标签找到它。', 2],
    ['双份留存', 'TWIN BACKUP', '分别成功导出 JSON 和 Markdown 数据。', 2],
    ['完整的光谱', 'FULL SPECTRUM', '在 12 个不同月份留下带情绪的已确认记忆。', 3],
  ]],
  ['SYS', '我的工作台', '让 Mirror 按照你的习惯，成为顺手的个人空间。', [
    ['安放日常', 'HOME BASE', '首次更改并保存默认首页。', 1],
    ['落笔的方式', 'WRITE YOUR WAY', '选择并保存自己的默认记录方式。', 1],
    ['记忆的远近', 'MEMORY RANGE', '调整并保存记忆检索的时间权重。', 1],
    ['回望的深度', 'LOOKBACK LENS', '选择并保存生成画像时的原文回看深度。', 1],
    ['另一种视角', 'ANOTHER VIEW', '切换桌面与手机布局，分别查看一次日常记录。', 1],
    ['熟悉这张桌子', 'KNOW THE DESK', '依次查看设置中的显示、记录、记忆和数据区域。', 1],
    ['量身调校', 'PERSONAL TUNING', '完成首页、记录方式、检索权重与回看深度的个人设置。', 2],
    ['自己的陈列室', 'OWN EXHIBITION', '选择 8 枚不同的章，排好顺序并保存一个完整展示架。', 2],
  ]],
]

const platingCodes = new Set(['M-03','M-08','R-02','R-04','D-05','D-08','K-04','K-08','P-02','P-08','C-02','C-08','REF-03','REF-08','T-02','T-07','V-02','V-08','G-05','G-08','S-02','S-08','SYS-07','SYS-08'])
const hiddenCodes = new Set(currentCatalog.filter(item => item.hidden).map(item => item.code))
const sampleEarned = new Set(['M-01','R-01','R-02','R-04','D-01','K-01','P-01','T-01','V-01','G-01','SYS-01'])
const samplePlated = new Set(['R-04'])

export const achievementSets = sets.map(([id, name, description]) => ({ id, name, description, count: 8 }))
export const achievementDesignCatalog = sets.flatMap(([id, setName, setDescription, rows]) => {
  const group = currentCatalog.find(item => item.group.id === id).group
  return rows.map(([name, english, condition, difficulty], index) => {
    const code = `${id}-${String(index + 1).padStart(2, '0')}`
    return {
      code, name, english, condition, difficulty, group, setName, setDescription,
      hidden: hiddenCodes.has(code), starter: difficulty === 1 && index < 5,
      atlas: `/art/achievements/sets/${id.toLowerCase()}-atlas.png`, atlasIndex: index,
      plating: platingCodes.has(code), earned: sampleEarned.has(code), plated: samplePlated.has(code),
      designOnly: true,
    }
  })
})
