// Component gallery: toy tokenization, computed attention and sampling, block diagrams, Agent trace,
// training, PCA embedding and RAG. All data are illustrative, not model output or real retrieval.
{
  const L = Deck.llmMath;
  const vocab = ['The', ' lat', 'tice', ' was', ' stable', ' because', ' it', ' relax', 'ed'];
  const tokenizer = L.tokenize.makeTokenizer(vocab);
  const text = 'The lattice was stable because it relaxed';
  const {tokens} = tokenizer.encode(text);
  const {Q,K} = L.attention.qkFromTokens(tokens,16,7);
  Deck.llmTokenSlide({name:'分词',text,tokenizer,note:'玩具词表和编号，不对应真实模型',steps:[
    {caption:'模型看到的是一整串字符',state:{split:false}},
    {caption:'将字符切成词元',state:{split:true}},
    {caption:'每个词元对应一个编号',state:{ids:true}},
    {caption:'一个词可以拆成多个子词',state:{focus:2}},
  ]});
  Deck.llmAttentionSlide({name:'注意力热图',tokens,weights:L.attention.attention(Q,K),causalWeights:L.attention.attention(Q,K,{causal:true}),note:'示意随机向量，非真实模型输出',steps:[
    {caption:'行是查询词元，列是被查询的词元',state:{rowsShown:1}},
    {caption:'每一行经缩放点积与 softmax 计算',state:{rowsShown:tokens.length}},
    {caption:'聚焦一行',state:{focusRow:6}},
    {caption:'因果掩码遮住未来并重新归一化',state:{focusRow:null,masked:true}},
  ]});
  const rounds=[
    {prefix:['The','lattice','was'],candidates:[{label:'stable',logit:3},{label:'unstable',logit:1.6},{label:'metallic',logit:1},{label:'cubic',logit:.4},{label:'cracked',logit:-.5}],chosen:0},
    {prefix:['The','lattice','was','stable'],candidates:[{label:'at',logit:2.6},{label:'under',logit:1.8},{label:'up',logit:1.2},{label:'and',logit:.9},{label:'only',logit:-.2}],chosen:0},
    {prefix:['The','lattice','was','stable','at'],candidates:[{label:'room',logit:2.2},{label:'high',logit:1.9},{label:'low',logit:1},{label:'ambient',logit:.8},{label:'every',logit:-.4}],chosen:0},
  ];
  Deck.llmNextTokenSlide({name:'逐词生成',rounds,note:'logits 是示意值，概率由 softmax 计算',steps:[
    {caption:'给定前缀，计算候选概率',state:{round:0,phase:'dist'}},{caption:'选择 stable',state:{phase:'pick'}},
    {caption:'前缀变长，再计算分布',state:{round:1,phase:'dist'}},{caption:'选择 at',state:{phase:'pick'}},
    {caption:'新一轮分布',state:{round:2,phase:'dist'}},{caption:'选择 room',state:{phase:'pick'}},
  ]});
  Deck.llmNextTokenSlide({name:'温度对比',rounds:[rounds[0]],showEntropy:true,note:'同一组示意 logits',steps:[
    {caption:'T = 1',state:{temp:1}},{caption:'温度降低，分布更集中',state:{temp:.5}},
    {caption:'温度升高，分布更分散',state:{temp:2}},{caption:'温度趋近于零，最大值占主导',state:{temp:.1}},
  ]});
  Deck.llmBlockSlide({name:'Decoder-only 架构',blocks:[{id:'input',label:'输入词元'},{id:'embed',label:'嵌入'},{id:'attention',label:'注意力',group:'layer'},{id:'ffn',label:'前馈',group:'layer'},{id:'head',label:'输出头'},{id:'out',label:'概率'}],steps:[
    ...['输入','嵌入','注意力','前馈','输出头','输出概率'].map((caption,i)=>({caption,state:{shown:i+1,active:i}})),
    {caption:'注意力和前馈组成一层，重复 N 次',state:{active:null,group:true}},
  ],note:'结构示意'});
  Deck.llmBlockSlide({name:'Transformer 块',direction:'column',blocks:[{id:'ln1',label:'LayerNorm'},{id:'attn',label:'多头注意力'},{id:'add1',label:'相加'},{id:'ln2',label:'LayerNorm'},{id:'ffn',label:'前馈'},{id:'add2',label:'相加'}],residuals:[{from:'ln1',to:'add1'},{from:'ln2',to:'add2'}],steps:[
    ...['归一化','注意力','相加','归一化','前馈','相加'].map((caption,i)=>({caption,state:{shown:i+1,active:i}})),
    {caption:'第一条残差',state:{active:null,residuals:1}},{caption:'第二条残差',state:{residuals:2}},
  ],note:'Pre-LN 简化示意'});
  const messages=[
    {type:'human',content:'检索并比较三个方案'},
    {type:'ai',tool_calls:[{id:'a',name:'task',args:{description:'检索方案 A',subagent_type:'research'}},{id:'b',name:'task',args:{description:'检索方案 B',subagent_type:'research'}}]},
    {type:'tool',tool_call_id:'a',name:'task',content:'完成',additional_kwargs:{subagent_status:'completed'}},
    {type:'tool',tool_call_id:'b',name:'task',content:'超时',additional_kwargs:{subagent_status:'timed_out'}},
    {type:'ai',tool_calls:[{id:'c',name:'task',args:{description:'检索方案 B',subagent_type:'research'}}]},
    {type:'tool',tool_call_id:'c',name:'task',content:'完成',additional_kwargs:{subagent_status:'completed'}},
    {type:'ai',content:'汇总结果并回答'},
  ];
  Deck.llmAgentSlide({name:'Agent 编排回放',trace:L.trace.fromMessages(messages),note:'手写消息，仅作回放示意'});
  const stages=[{label:'预训练',data:'约 10¹² 词元',goal:'预测下一个词元'},{label:'指令微调',data:'约 10⁵ 条指令',goal:'学习遵循指令'},{label:'偏好对齐',data:'约 10⁵ 组偏好',goal:'调整回答偏好'}];
  Deck.llmTrainingSlide({name:'训练管线',stages,note:'常见流程与数据规模的简化示意'});
  const names=['晶体','合金','陶瓷','薄膜','热导率','带隙','电导率','塞贝克','密度泛函','分子动力学','机器学习','实验'];
  const centers=[[3,0,0,1,0,0],[-1.5,2.6,0,0,1,0],[-1.5,-2.6,0,0,0,1]], offsets=[[-.65,-.5],[.65,-.5],[-.65,.5],[.65,.5]];
  const vectors=names.map((_,i)=>centers[Math.floor(i/4)].map((v,j)=>v+(j<2?offsets[i%4][j]:j===2?(i%4-1.5)*.08:0)));
  const nearest=L.embedding.nearest(vectors,4,3);
  Deck.llmEmbeddingSlide({name:'Embedding 向量与近邻',vectors,labels:names,groups:names.map((_,i)=>Math.floor(i/4)),note:'手工六维向量；PCA 仅用于显示',steps:[
    {caption:'材料词的向量投影到二维',state:{groupsShown:1}},{caption:'加入物性词',state:{groupsShown:2}},
    {caption:'加入方法词',state:{groupsShown:3}},{caption:'每个点代表一个词',state:{labels:true}},
    {caption:'以热导率为查询',state:{highlight:[4]}},{caption:'近邻按原始六维余弦相似度选择',state:{highlight:[4,...nearest]}},
  ]});
  Deck.llmBlockSlide({name:'RAG：检索后生成',blocks:[{id:'q',label:'问题'},{id:'retrieve',label:'检索'},{id:'kb',label:'知识库',below:'retrieve'},{id:'snippets',label:'片段'},{id:'prompt',label:'提示'},{id:'generate',label:'生成'},{id:'answer',label:'回答'}],links:[{from:'kb',to:'retrieve'}],steps:[
    ...['问题','检索','知识库提供索引','取回片段','拼入提示','生成','回答'].map((caption,i)=>({caption,state:{shown:i+1,active:i}})),
    {caption:'检索提供上下文，生成组织回答',state:{active:null}},
  ],note:'结构示意，不执行检索或推理'});
}
