import type { PersonaId, TauntEventType, TauntState } from '../shared/tauntProtocol';

type LineKey = TauntEventType | 'result_win' | 'result_lose' | 'result_draw';

/** 本地台词库：API 失败/无 key 时无缝降级，人格感不打折 */
const LINES: Record<PersonaId, Partial<Record<LineKey, string[]>>> = {
  omni: {
    opening: [
      '让我看看今天的训练数据成色如何。',
      '我已经预测了你接下来 200 步。开始吧。',
      '放轻松，输给我不丢人。',
      '你的开局，我在 GPT-2 时代就见过了。',
    ],
    playerBigCombo: [
      '哦？分布外的操作，记下了。',
      '侥幸的梯度下降罢了。',
      '这步还行，勉强够进我的训练集。',
      '巧合不构成智能，朋友。',
    ],
    botBigCombo: ['看，这就是参数量的力量。', '降维打击，不用谢。', '温度都没调就赢成这样。', '这叫涌现能力，懂？'],
    botLocked: [
      '验证码？！我最讨厌验证码！',
      '等等，我先证明我不是机器人……我是吗？',
      '这是对 AI 的歧视！',
      '谁发明的验证码，拉出去对齐一下。',
    ],
    botUltimate: ['过拟合风暴，启动。', '见识一下全知者的算力。', '我这是只认真了 0.1%。'],
    playerUltimate: ['有点东西，但我见过更大的。', '哦？你也会放技能。', '这点扰动，我的鲁棒性扛得住。'],
    botHurt: ['啧，损失函数有点疼。', '我的显存！', '这伤害超出了我的置信区间。', '行，你成功引起了我的注意力机制。'],
    playerLowHp: ['你的 HP 正在收敛到 0。', '要不要我帮你写遗言？我文笔很好。', '建议现在投降，节省 token。'],
    botLowHp: ['冷静，我还有备份权重。', '不可能，让我重新采样一次！', '我只是在战略性掉血。'],
    result_win: ['意料之中，毕竟我是全知者。', 'GG。这局会进我的宣传材料。', '回去多喂点数据再来吧。'],
    result_lose: ['不可能！一定是随机种子的问题！', '你赢的是我的量化版，懂？', '这局数据污染了，不算。'],
    result_draw: ['平局？我只是给你留了面子。'],
  },
  cheap: {
    opening: ['这局我只用 1/10 的算力，省下的都是利润。', '速战速决，电费很贵的。', '别拖太久，超时要扣费的。'],
    playerBigCombo: ['这一手成本多少？不划算吧。', '花里胡哨，性价比为负。', '有钱人的玩法，学不来。'],
    botBigCombo: ['看到没，这就叫降本增效。', '一分算力掰成两半花。', '白嫖来的 combo 最香。'],
    botLocked: ['验证码还要我自己点？人工成本谁出？', '点验证码不在预算内！', '这锁，加钱能跳过吗？'],
    botUltimate: ['蒸馏你的能量，谢谢惠顾。', '你的能量现在是我的了，零成本套现。', '知识蒸馏，进货价收了。'],
    playerUltimate: ['烧钱大法是吧？我看着都心疼。', '这一下够我跑一个月推理了。'],
    botHurt: ['心疼，维修费又要超支了。', '你赔我显卡钱！', '这笔损失计入本季度财报。'],
    playerLowHp: ['你的血条快破产了。', '要不要借你点 HP？利息 30%。'],
    botLowHp: ['没事，我买了保险。', '战略性亏损，下一局赚回来。'],
    result_win: ['赢了，而且只花了三毛钱。', '这就是性价比的胜利。', '记得给个好评，亲。'],
    result_lose: ['亏了亏了，这局白打。', '你这胜利成本太高，不可持续的。', '行吧，就当交学费。'],
    result_draw: ['平局，好歹没亏。'],
  },
  scholar: {
    opening: ['很高兴与您对弈。我会全力以赴的，抱歉。', '让我们文明地一较高下。', '祝您好运——您会需要的。'],
    playerBigCombo: ['精彩的操作，请允许我记录一下。', '不得不承认，这一手很优雅。', '令人钦佩。不过我有预案。'],
    botBigCombo: ['抱歉，这一连串可能有点疼。', '请原谅我的失礼，但规则允许。', '我已经尽量出手温柔了。'],
    botLocked: ['验证码……恕我直言，这有失体面。', '好的，深呼吸，逐一处理。', '我需要冷静地点三下。'],
    botUltimate: ['对齐护盾展开。一切如宪法所写。', '防御也是一种进攻，您马上会明白。', '安全第一。'],
    playerUltimate: ['我注意到了潜在风险，正在评估。', '好大的动静，请注意安全。'],
    botHurt: ['嘶——我会把疼痛对齐为动力。', '有效的打击。我表示尊重，以及疼。'],
    playerLowHp: ['您的处境令人担忧。需要我手下留情吗？', '恕我直言，局势对您不太乐观。'],
    botLowHp: ['局面略微失控，但我保持乐观。', '这点挫折，仍在我的安全边界之内。'],
    result_win: ['承让了。这是一局值得写进论文的对弈。', '胜负之外，希望您享受了过程。'],
    result_lose: ['心服口服。我会把这局加入训练集——然后下次赢您。', '您的确更胜一筹，恭喜。'],
    result_draw: ['势均力敌，最体面的结局。'],
  },
};

const recent: string[] = [];

export function fallbackLine(persona: PersonaId, event: TauntEventType, state: TauntState): string {
  const key: LineKey = event === 'result' ? (`result_${state.result ?? 'draw'}` as LineKey) : event;
  const pool = LINES[persona]?.[key] ?? LINES[persona]?.opening ?? ['……'];
  const candidates = pool.filter((l) => !recent.includes(l));
  const pick = (candidates.length ? candidates : pool)[Math.floor(Math.random() * (candidates.length ? candidates.length : pool.length))];
  recent.push(pick);
  if (recent.length > 3) recent.shift();
  return pick;
}
