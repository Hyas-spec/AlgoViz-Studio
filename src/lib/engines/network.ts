import { validateScene, type Scene, type SequenceState, type Step } from '../dsl';
import { clampInt, type Params } from './common';

type Tone = 'syn' | 'ack' | 'data' | 'fin' | 'lost';

interface Lane {
  id: string;
  label: string;
}

interface Message {
  id: string;
  from: string;
  to: string;
  label: string;
  tone?: Tone;
  lost?: boolean;
}

interface Note {
  lane: string;
  text: string;
}

const LANES: Lane[] = [
  { id: 'client', label: '客户端' },
  { id: 'server', label: '服务器' },
];

/** 缩写注释：给零基础读者的最小术语表，渲染在左页 facts 下方。 */
const HANDSHAKE_GLOSSARY = [
  { term: 'SYN', text: 'Synchronize：请求建连，并报出初始序号' },
  { term: 'ACK', text: 'Acknowledgement：确认「你发的我收到了」' },
  { term: 'SYN+ACK', text: '同时确认对方、报出自己的序号' },
  { term: 'seq 字段', text: '发送序号：本次发送从第几号字节开始，初始值由发送方自选' },
  { term: 'ack 字段', text: '确认号：已收到对方的序号，下一个期望它 +1' },
  { term: 'ESTABLISHED', text: '连接已建立，可以正常收发数据' },
  { term: 'LISTEN', text: '服务器在端口上等待连接' },
  { term: 'SYN-SENT', text: '客户端已发 SYN，等对方回复' },
  { term: 'SYN-RCVD', text: '服务器已回 SYN+ACK，等最后确认' },
  { term: 'RTT', text: '往返时延：一个报文来回一趟的时间' },
];

const WAVE_GLOSSARY = [
  { term: 'FIN', text: 'Finish：我没有数据要发了，请求关闭' },
  { term: 'ACK', text: 'Acknowledgement：确认「你发的我收到了」' },
  { term: 'seq 字段', text: '发送序号：本次发送从第几号字节开始，初始值由发送方自选' },
  { term: 'ack 字段', text: '确认号：已收到对方的序号，下一个期望它 +1' },
  { term: 'CLOSE-WAIT', text: '收到对方 FIN，等自己数据发完' },
  { term: 'LAST-ACK', text: '已发 FIN，等对方最后一个 ACK' },
  { term: 'TIME-WAIT', text: '主动关闭方等 2MSL 再真正关闭' },
  { term: '2MSL', text: '两倍报文寿命，等旧报文在网络里消散' },
  { term: 'ESTABLISHED', text: '关闭开始前，双方正常收发数据' },
  { term: 'RTT', text: '往返时延：四次挥手约 2 个 RTT' },
];

function pushStep(
  steps: Step[],
  messages: Message[],
  active: string | null,
  notes: Note[],
  caption: string,
  codeLine: number,
  doneAll = false,
): void {
  const state: SequenceState = {
    kind: 'sequence',
    lanes: LANES.map((lane) => ({ ...lane })),
    messages: messages.map((message) => ({ ...message })),
    active,
    notes: notes.map((note) => ({ ...note })),
  };
  steps.push({ caption, codeLine, doneAll: doneAll ? true : undefined, state });
}

/* ------------------------------------------------------------------ */
/* 三次握手                                                            */
/* ------------------------------------------------------------------ */

const SYN: Message = { id: 'm1', from: 'client', to: 'server', label: 'SYN, seq=x', tone: 'syn' };
const SYN_ACK: Message = { id: 'm2', from: 'server', to: 'client', label: 'SYN+ACK, ack=x+1', tone: 'syn' };
const ACK: Message = { id: 'm3', from: 'client', to: 'server', label: 'ACK, ack=y+1', tone: 'ack' };
const SYN_LOST: Message = { ...SYN, id: 'm1l', lost: true, tone: 'lost' };
const SYN_RETRY: Message = { ...SYN, id: 'm1b', label: 'SYN, seq=x（重传）' };

function handshakeSteps(loss: boolean): { steps: Step[]; marks: number[] } {
  const steps: Step[] = [];
  const marks = [-1, -1, -1, -1];
  const idle: Note[] = [
    { lane: 'client', text: 'CLOSED' },
    { lane: 'server', text: 'LISTEN' },
  ];

  pushStep(
    steps,
    [],
    null,
    idle,
    '两台机器还没建立连接：客户端处于 CLOSED，服务器在 LISTEN（监听）等连接。',
    1,
  );
  marks[0] = 0;

  if (!loss) {
    pushStep(steps, [SYN], SYN.id, [
      { lane: 'client', text: 'SYN-SENT' },
      { lane: 'server', text: 'LISTEN' },
    ], '客户端发送 SYN（同步请求），报出初始序号 seq = x，进入 SYN-SENT（已发请求，等回复）。', 1);
    marks[1] = steps.length - 1;

    pushStep(steps, [SYN, SYN_ACK], SYN_ACK.id, [
      { lane: 'client', text: 'SYN-SENT' },
      { lane: 'server', text: 'SYN-RCVD' },
    ], '服务器收到 SYN，回 SYN+ACK（同步 + 确认）：确认 x（ack = x+1），报出自己的序号 y，进入 SYN-RCVD（等最后确认）。', 2);
    marks[2] = steps.length - 1;

    pushStep(steps, [SYN, SYN_ACK, ACK], ACK.id, [
      { lane: 'client', text: 'ESTABLISHED' },
      { lane: 'server', text: 'SYN-RCVD' },
    ], '客户端收到 SYN+ACK，回 ACK（确认，ack = y+1）。到此双方都确认了对方的收发能力。', 3);
    marks[3] = steps.length - 1;

    pushStep(steps, [SYN, SYN_ACK, ACK], null, [
      { lane: 'client', text: 'ESTABLISHED' },
      { lane: 'server', text: 'ESTABLISHED' },
    ], '服务器收到 ACK，也进入 ESTABLISHED（已建立）。三次握手结束，可以开始传数据。', 4, true);
    return { steps, marks };
  }

  pushStep(steps, [SYN_LOST], SYN_LOST.id, [
    { lane: 'client', text: 'SYN-SENT' },
    { lane: 'server', text: 'LISTEN' },
  ], '客户端的 SYN（同步请求）在半路丢了。服务器什么都没收到，客户端只能等超时。', 1);
  marks[1] = steps.length - 1;

  pushStep(steps, [SYN_LOST, SYN_RETRY], SYN_RETRY.id, [
    { lane: 'client', text: 'SYN-SENT' },
    { lane: 'server', text: 'LISTEN' },
  ], '超时后客户端重传 SYN，序号仍然是 x。这一次顺利到达服务器。', 1);

  pushStep(steps, [SYN_LOST, SYN_RETRY, SYN_ACK], SYN_ACK.id, [
    { lane: 'client', text: 'SYN-SENT' },
    { lane: 'server', text: 'SYN-RCVD' },
  ], '服务器收到重传的 SYN，回 SYN+ACK：确认 x，同时报出自己的序号 y。', 2);
  marks[2] = steps.length - 1;

  pushStep(steps, [SYN_LOST, SYN_RETRY, SYN_ACK, ACK], ACK.id, [
    { lane: 'client', text: 'ESTABLISHED' },
    { lane: 'server', text: 'SYN-RCVD' },
  ], '客户端回 ACK（确认，ack = y+1），确认服务器的序号。', 3);
  marks[3] = steps.length - 1;

  pushStep(steps, [SYN_LOST, SYN_RETRY, SYN_ACK, ACK], null, [
    { lane: 'client', text: 'ESTABLISHED' },
    { lane: 'server', text: 'ESTABLISHED' },
  ], '服务器收到 ACK，双方进入 ESTABLISHED（已建立）。丢包只让连接晚了一个超时周期。', 4, true);
  return { steps, marks };
}

/* ------------------------------------------------------------------ */
/* 四次挥手                                                            */
/* ------------------------------------------------------------------ */

const FIN: Message = { id: 'f1', from: 'client', to: 'server', label: 'FIN, seq=u', tone: 'fin' };
const ACK1: Message = { id: 'f2', from: 'server', to: 'client', label: 'ACK, ack=u+1', tone: 'ack' };
const FIN2: Message = { id: 'f3', from: 'server', to: 'client', label: 'FIN, seq=v', tone: 'fin' };
const ACK2: Message = { id: 'f4', from: 'client', to: 'server', label: 'ACK, ack=v+1', tone: 'ack' };
const FIN2_LOST: Message = { ...FIN2, id: 'f3l', lost: true, tone: 'lost' };
const FIN2_RETRY: Message = { ...FIN2, id: 'f3b', label: 'FIN, seq=v（重传）' };

function waveSteps(loss: boolean): { steps: Step[]; marks: number[] } {
  const steps: Step[] = [];
  const marks = [-1, -1, -1, -1];

  pushStep(steps, [], null, [
    { lane: 'client', text: 'ESTABLISHED' },
    { lane: 'server', text: 'ESTABLISHED' },
  ], '连接已建立，双方都在 ESTABLISHED（已建立）。这一次由客户端先提出关闭。', 1);
  marks[0] = 0;

  pushStep(steps, [FIN], FIN.id, [
    { lane: 'client', text: 'FIN-WAIT-1' },
    { lane: 'server', text: 'ESTABLISHED' },
  ], '客户端发送 FIN（结束请求，seq = u），表示自己没有数据要发了，进入 FIN-WAIT-1（等对方确认）。', 1);
  marks[1] = steps.length - 1;

  pushStep(steps, [FIN, ACK1], ACK1.id, [
    { lane: 'client', text: 'FIN-WAIT-2' },
    { lane: 'server', text: 'CLOSE-WAIT' },
  ], '服务器先回 ACK（确认，ack = u+1），进入 CLOSE-WAIT（等我方数据发完）；客户端收到后进入 FIN-WAIT-2（等对方 FIN）。连接半关闭：客户端不再发，服务器还能发。', 2);
  marks[2] = steps.length - 1;

  if (!loss) {
    pushStep(steps, [FIN, ACK1, FIN2], FIN2.id, [
      { lane: 'client', text: 'FIN-WAIT-2' },
      { lane: 'server', text: 'LAST-ACK' },
    ], '服务器把剩下的数据发完，也发 FIN（结束请求，seq = v），进入 LAST-ACK（等最后确认）。', 3);
    marks[3] = steps.length - 1;

    pushStep(steps, [FIN, ACK1, FIN2, ACK2], ACK2.id, [
      { lane: 'client', text: 'TIME-WAIT' },
      { lane: 'server', text: 'CLOSED' },
    ], '客户端回最后一个 ACK（确认，ack = v+1），进入 TIME-WAIT（等 2MSL 再关闭）；服务器收到后关闭。', 4);

    pushStep(steps, [FIN, ACK1, FIN2, ACK2], null, [
      { lane: 'client', text: 'CLOSED' },
      { lane: 'server', text: 'CLOSED' },
    ], '客户端等过 2MSL（两倍报文寿命）才真正关闭，确保最后的 ACK 丢了还能重传。四次挥手结束。', 5, true);
    return { steps, marks };
  }

  pushStep(steps, [FIN, ACK1, FIN2_LOST], FIN2_LOST.id, [
    { lane: 'client', text: 'FIN-WAIT-2' },
    { lane: 'server', text: 'LAST-ACK' },
  ], '服务器的 FIN（结束请求）在半路丢了。客户端还在 FIN-WAIT-2 等，服务器收不到确认，只能等超时。', 3);

  pushStep(steps, [FIN, ACK1, FIN2_LOST, FIN2_RETRY], FIN2_RETRY.id, [
    { lane: 'client', text: 'FIN-WAIT-2' },
    { lane: 'server', text: 'LAST-ACK' },
  ], '超时后服务器重传 FIN（seq = v）。这一次到达客户端。', 3);
  marks[3] = steps.length - 1;

  pushStep(steps, [FIN, ACK1, FIN2_LOST, FIN2_RETRY, ACK2], ACK2.id, [
    { lane: 'client', text: 'TIME-WAIT' },
    { lane: 'server', text: 'CLOSED' },
  ], '客户端回最后一个 ACK（确认，ack = v+1），进入 TIME-WAIT（等 2MSL 再关闭）；服务器收到后关闭。', 4);

  pushStep(steps, [FIN, ACK1, FIN2_LOST, FIN2_RETRY, ACK2], null, [
    { lane: 'client', text: 'CLOSED' },
    { lane: 'server', text: 'CLOSED' },
  ], '客户端等过 2MSL（两倍报文寿命）才真正关闭。丢包只是让挥手多花一个超时周期。', 5, true);
  return { steps, marks };
}

/* ------------------------------------------------------------------ */
/* 左页文案                                                            */
/* ------------------------------------------------------------------ */

interface Spec {
  title: string;
  chapter: string;
  section: string;
  kicker: string;
  figNo: string;
  pages: [number, number];
  summary: string;
  body: string[];
  formula: string;
  complexity: { time: string; space: string };
  code: string[];
  note: string;
  question: string;
  figure: string;
  facts: { label: string; value: string }[];
  outline: { label: string; value: string }[];
}

const HANDSHAKE_SPEC: Spec = {
  title: '三次握手',
  chapter: 'CH.06 / NETWORK — TCP HANDSHAKE',
  section: '第六讲 · 传输层',
  kicker: 'TCP HANDSHAKE',
  figNo: '6.1',
  pages: [26, 27],
  summary: '客户端先报序号，服务器确认并报自己的序号，客户端再确认一次；三个报文把双向通道都验一遍。',
  body: [
    'TCP（传输控制协议）是全双工的：两个方向都要能发、能收。只发一次 SYN（同步请求），服务器只能确认「客户端能发、自己能收」；再回一次 SYN+ACK（同步 + 确认），才证明「服务器能发、客户端能收」。',
    '第三个 ACK（确认）是客户端对服务器序号的确认。没有它，服务器不知道自己的 SYN+ACK 是否送达。三个报文刚好覆盖两个方向，少一个都不够。',
  ],
  formula: '\\text{SYN} \\to \\text{SYN+ACK} \\to \\text{ACK}',
  complexity: { time: '1 RTT', space: 'O(1)' },
  code: [
    'C: send(SYN, seq=x)                  // SYN 同步 → SYN-SENT',
    'S: recv(SYN); send(SYN+ACK, ack=x+1) // SYN+ACK → SYN-RCVD',
    'C: recv(SYN+ACK); send(ACK, ack=y+1) // ACK 确认 → ESTABLISHED',
    'S: recv(ACK)                         // → ESTABLISHED',
  ],
  note: '为什么不是两次握手？两次只能确认一个方向；服务器无法知道自己的 SYN+ACK 有没有被收到。',
  question: '追问一句：为什么三次握手不能减成两次？',
  figure: 'TCP HANDSHAKE',
  facts: [
    { label: '报文数', value: '3' },
    { label: '建立耗时', value: '1 RTT' },
    { label: '结束状态', value: 'ESTABLISHED' },
  ],
  outline: [
    { label: '客户端 SYN', value: 'seq=x' },
    { label: '服务器 SYN+ACK', value: 'ack=x+1' },
    { label: '客户端 ACK', value: 'ack=y+1' },
    { label: '连接建立', value: 'ESTABLISHED' },
  ],
};

const WAVE_SPEC: Spec = {
  title: '四次挥手',
  chapter: 'CH.06 / NETWORK — TCP TEARDOWN',
  section: '第六讲 · 传输层',
  kicker: 'TCP TEARDOWN',
  figNo: '6.2',
  pages: [28, 29],
  summary: '一方先发 FIN（结束请求），另一方先确认；等自己数据发完再发 FIN，最后再确认一次，连接才真正关闭。',
  body: [
    '关闭比建立多一次，因为 TCP（传输控制协议）连接是两个方向独立的。客户端说「我不发了」只是半关闭，服务器可能还有数据要发，所以先回 ACK（确认），等数据发完再发自己的 FIN（结束请求）。',
    '最后一个 ACK 由主动关闭方发出后，它还要在 TIME-WAIT（时间等待）等 2MSL（两倍报文寿命）：万一 ACK 丢了，对方重传 FIN 时还能再确认一次，也顺便让旧连接的残余报文在网络里消散。',
  ],
  formula: '\\text{FIN} \\to \\text{ACK} \\to \\text{FIN} \\to \\text{ACK}',
  complexity: { time: '2 RTT', space: 'O(1)' },
  code: [
    'C: send(FIN, seq=u)                  // FIN 结束 → FIN-WAIT-1',
    'S: recv(FIN); send(ACK, ack=u+1)     // ACK 确认 → CLOSE-WAIT',
    'S: send(FIN, seq=v)                  // FIN 结束 → LAST-ACK',
    'C: recv(FIN); send(ACK, ack=v+1)     // ACK 确认 → TIME-WAIT',
    'C: wait 2MSL                         // 等 2MSL → CLOSED',
  ],
  note: '为什么挥手要四次？TCP 是全双工的，一方不再发送，另一方可能还有数据要发，只能先确认、后关闭。',
  question: '追问一句：为什么关闭连接需要四次挥手？',
  figure: 'TCP TEARDOWN',
  facts: [
    { label: '报文数', value: '4' },
    { label: '半关闭', value: 'CLOSE-WAIT' },
    { label: '主动方等待', value: '2MSL' },
  ],
  outline: [
    { label: '客户端 FIN', value: 'FIN-WAIT-1' },
    { label: '服务器 ACK', value: 'CLOSE-WAIT' },
    { label: '服务器 FIN', value: 'LAST-ACK' },
    { label: '最后 ACK', value: 'TIME-WAIT' },
  ],
};

function sceneFor(kind: 'handshake' | 'wave', params: Params): Scene {
  const spec = kind === 'handshake' ? HANDSHAKE_SPEC : WAVE_SPEC;
  const loss = clampInt(params.loss, 0, 0, 1) === 1;
  const built = kind === 'handshake' ? handshakeSteps(loss) : waveSteps(loss);

  return validateScene({
    id: kind,
    title: spec.title,
    chapter: spec.chapter,
    section: spec.section,
    kicker: spec.kicker,
    figNo: spec.figNo,
    pages: spec.pages,
    layout: 'sequence',
    category: 'network',
    summary: spec.summary,
    body: spec.body,
    formula: spec.formula,
    complexity: spec.complexity,
    code: spec.code,
    note: spec.note,
    question: spec.question,
    figure: spec.figure,
    facts: spec.facts,
    glossary: kind === 'handshake' ? HANDSHAKE_GLOSSARY : WAVE_GLOSSARY,
    outline: spec.outline.map((item, i) => ({ ...item, step: built.marks[i] >= 0 ? built.marks[i] : 0 })),
    params: [
      {
        key: 'loss',
        label: '丢包',
        kind: 'enum',
        default: 0,
        min: 0,
        max: 1,
        options: [
          { value: 0, label: '正常' },
          { value: 1, label: '丢包' },
        ],
      },
    ],
    source: 'builtin',
    steps: built.steps,
  });
}

export const handshakeScene = (params: Params = {}) => sceneFor('handshake', params);
export const waveScene = (params: Params = {}) => sceneFor('wave', params);
